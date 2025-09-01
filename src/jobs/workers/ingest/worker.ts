import '~/config';
import { Job, Queue } from 'bullmq';
// import { getOrCreateCheckpoint } from 'services/checkpoints';
import { sources } from '~/sources';
import { logger } from '~/utils/logger';
import { IngestWorkerType } from './types';
import { INGEST_QUEUE_NAME, redisConnection } from '~/jobs/worker-config';
import { checkpoints } from '~/services/checkpoints';

function getAdapter(key: string) {
  const a = sources.find((s) => s.key === key);
  if (!a) throw new Error(`Unknown source ${key}`);
  return a;
}

const queue = new Queue<IngestWorkerType>(INGEST_QUEUE_NAME, { connection: redisConnection });

export default async function (job: Job<IngestWorkerType>) {
  logger.info(`Processing job ${job.id} for source ${job.data.source} with cursor ${job.data.cursor} / ${job.name}`);
  const adapter = getAdapter(job.data.source);
  logger.info(`Using adapter ${adapter.key}`);
  const cp = await checkpoints.getOrCreate(job.data.chainId, adapter.key);
  logger.info({ checkpoint: true, cp }, `Using checkpoint for adapter ${adapter.key}`);
  const cursor = job.data.cursor ?? cp.cursor ?? adapter.initialCursor ?? null;
  logger.info(`Using cursor ${cursor} for adapter ${adapter.key}`);

  const { items, nextCursor } = await adapter.fetchNext(job.data.chainId, cursor);

  for (const it of items) {
    // todo: process adapter data
    // await upsertRaw(it);
    // const userId = await toUserId(it.userExternalId);
    // await upsertLedger(it, userId);
    // await summarizeQueue.add('sum', { userId, currency: it.currency }, { removeOnComplete: 1000, removeOnFail: 1000 });
  }

  logger.info(`Ingested ${items.length} items from ${adapter.key}, ${nextCursor}`);

  await checkpoints.saveCursor(job.data.chainId, adapter.key, nextCursor ?? null, new Date());

  if (nextCursor) {
    logger.info(`Enqueuing next page for ${adapter.key} with cursor ${nextCursor}`);
    await job.updateProgress({ nextCursor });
    // enqueue next page immediately
    await queue.add('page', { source: adapter.key, chainId: job.data.chainId, cursor: nextCursor });
  }
}
