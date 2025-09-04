import '~/config';
import { Job } from 'bullmq';

import { getAdapter } from './helpers';
import { IngestWorkerType } from './types';

import { IngestionSource, IngestionSourceMode } from '~/database/schema';
import { Context, HighWaterMark } from '~/domain/types';
import { ingestQueue } from '~/jobs/queues';
import { networks } from '~/loader/networks';
import { checkpoints } from '~/services/checkpoints';
import { encode } from '~/utils/encode';
import { logger } from '~/utils/logger';

const log = logger.child({ worker: 'ingest.worker' });

Error.stackTraceLimit = Infinity;

export default async function (job: Job<IngestWorkerType>) {
  try {
    const key = encode.identity([job.data.source, job.data.chainId.toString()]);

    const adapter = getAdapter(job.data.source);
    const cp = await checkpoints.getOrCreate(
      key,
      [job.data.source, job.data.chainId.toString()],
      adapter.highWaterMark,
    );

    const chain = networks.getByChainId(job.data.chainId);
    const ctx: Context = { chain, checkpoint: cp };

    if (adapter.enabled) {
      if (!(await adapter.enabled(ctx))) {
        job.log('adapter disabled');
        return 'DISABLED';
      }
    }

    if (adapter.throttle) {
      const waitTime = await adapter.throttle(ctx);
      const timeSinceLastRun = Date.now() - (cp.lastSyncedAt?.getTime() || 0);
      if (timeSinceLastRun < waitTime * 1000) {
        job.log(`throttling ingestion for ${waitTime} seconds`);

        await ingestQueue.removeDeduplicationKey(`ingest:${adapter.name}:${job.data.chainId}`);
        await ingestQueue.add(
          'throttled',
          { source: adapter.name, chainId: job.data.chainId },
          { deduplication: { id: `ingest:${adapter.name}:${job.data.chainId}` }, delay: waitTime * 1000 },
        );

        return 'THROTTLED';
      }
    }

    // backfilling
    if (cp.mode === IngestionSourceMode.backfill) {
      job.log('backfill mode');
      await handleBackfill(job, adapter, cp, ctx);
      return 'OK:1';
    }

    job.log('live mode');

    // LIVE mode, with 24h safety buffer
    const watermark =
      cp.highWaterMark === HighWaterMark.date
        ? new Date(Number(cp.liveWatermark) ?? cp.lastSyncedAt ?? new Date()).getTime() -
          (adapter.highWaterOverlapWindow ?? 172800) * 1000
        : Number(cp.liveWatermark) - (adapter.highWaterOverlapWindow ?? 1000);

    job.log('watermark: ' + watermark);

    if (adapter.fetchIncremental) {
      job.log('fetching incremental data');
      const { items, nextCursor } = await adapter.fetchIncremental(watermark.toString(), cp.liveCursor, ctx);
      const { highWater } = await adapter.ingest(items, ctx);
      await adapter.onLiveIngested?.(items, ctx);

      await checkpoints.markIncrementalProgress(key, nextCursor, highWater);
      if (nextCursor) {
        job.log('scheduling next page');
        await ingestQueue.removeDeduplicationKey(`ingest:${adapter.name}:${job.data.chainId}`);
        await ingestQueue.add(
          'page',
          { source: adapter.name, chainId: job.data.chainId },
          { deduplication: { id: `ingest:${adapter.name}:${job.data.chainId}` } },
        );
      }

      job.log('fetching incremental data done');
      return 'OK:2';
    } else {
      job.log('fallback to backfill');
      // Fallback: call backfill until safety lag window, then remain in live mode and rely on watermark + overlap on each poll.
      await handleBackfill(job, adapter, cp, ctx, true);
      return 'OK:3';
    }
  } catch (err) {
    log.error({ err, job }, 'Error processing ingest job');
    throw err;
  }
}

async function handleBackfill(
  job: Job<IngestWorkerType>,
  adapter: ReturnType<typeof getAdapter>,
  cp: IngestionSource,
  ctx: Context<unknown>,
  isLiveFallback: boolean = false,
) {
  const { items, nextCursor, atLiveEdge } = await adapter.fetchBackfill(cp.backfillCursor ?? null, ctx);

  const { highWater } = await adapter.ingest(items, ctx);

  if (!isLiveFallback) {
    await adapter.onBackfillIngested?.(items, ctx);
    await checkpoints.markBackfillProgress(cp, nextCursor, highWater);
  } else {
    await adapter.onLiveIngested?.(items, ctx);
    await checkpoints.markIncrementalProgress(cp.key, nextCursor, highWater);
  }

  if (nextCursor || atLiveEdge) {
    job.log('scheduling next page');
    await ingestQueue.removeDeduplicationKey(`ingest:${adapter.name}:${job.data.chainId}`);
    await ingestQueue.add(
      'page',
      { source: job.data.source, chainId: job.data.chainId },
      { deduplication: { id: `ingest:${adapter.name}:${job.data.chainId}` } },
    );
  }

  job.log('backfill page done');
}
