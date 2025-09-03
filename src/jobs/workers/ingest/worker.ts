import '~/config';
import { Job } from 'bullmq';

import { getAdapter } from './helpers';
import { IngestWorkerType } from './types';

import { IngestionSource, IngestionSourceMode } from '~/database/schema';
import { Context } from '~/domain/types';
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
    const cp = await checkpoints.getOrCreate(key, [job.data.source, job.data.chainId.toString()]);

    const chain = networks.getByChainId(job.data.chainId);
    const ctx = { chain };

    // backfilling
    if (cp.mode === IngestionSourceMode.backfill) {
      job.log('backfill mode');
      await handleBackfill(job, adapter, cp, ctx);
      return 'OK:1';
    }

    job.log('live mode');

    // LIVE mode, with 24h safety buffer
    const watermark = new Date(cp.liveSince ?? cp.lastSyncedAt ?? new Date(0)).getTime() - 86400_000;

    job.log('watermark: ' + watermark);

    if (adapter.fetchIncremental) {
      job.log('fetching incremental data');
      const { items, nextCursor } = await adapter.fetchIncremental(watermark.toString(), cp.liveCursor, ctx);
      await adapter.ingest(items, ctx);
      await adapter.onLiveIngested?.(items, ctx);

      await checkpoints.markIncrementalProgress(key, nextCursor);
      if (nextCursor) {
        job.log('scheduling next page');
        await ingestQueue.add('page', { source: adapter.name, chainId: job.data.chainId });
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

  const { lastTimestamp } = await adapter.ingest(items, ctx);

  if (!isLiveFallback) {
    await adapter.onBackfillIngested?.(items, ctx);
    await checkpoints.markBackfillProgress(cp.key, nextCursor, lastTimestamp);
  } else {
    await adapter.onLiveIngested?.(items, ctx);
    await checkpoints.markIncrementalProgress(cp.key, nextCursor);
  }

  if (nextCursor || atLiveEdge) {
    job.log('scheduling next page');
    await ingestQueue.add('page', { source: job.data.source, chainId: job.data.chainId });
  }

  job.log('backfill page done');
}
