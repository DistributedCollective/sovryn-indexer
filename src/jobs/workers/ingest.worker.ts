import { Worker, Job } from 'bullmq';
import config from '~/config';
import IORedis from 'ioredis';
// import { getOrCreateCheckpoint } from 'services/checkpoints';
import { sources } from '~/sources';
import { logger } from '~/utils/logger';

function getAdapter(key: string) {
  const a = sources.find((s) => s.key === key);
  if (!a) throw new Error(`Unknown source ${key}`);
  return a;
}

type IngestWorkerType = { source: string; cursor?: string | null };

export default async function (job: Job<IngestWorkerType>) {
  logger.info(`Processing job ${job.id} for source ${job.data.source} with cursor ${job.data.cursor} / ${job.name}`);
  const adapter = getAdapter(job.data.source);
  // const cp = await getOrCreateCheckpoint(adapter.key);
  const cp = { cursor: null };
  const cursor = job.data.cursor ?? cp.cursor ?? adapter.initialCursor ?? null;

  const { items, nextCursor } = await adapter.fetchNext(cursor);

  for (const it of items) {
    // todo: process adapter data
    // await upsertRaw(it);
    // const userId = await toUserId(it.userExternalId);
    // await upsertLedger(it, userId);
    // await summarizeQueue.add('sum', { userId, currency: it.currency }, { removeOnComplete: 1000, removeOnFail: 1000 });
  }

  logger.info(`Ingested ${items.length} items from ${adapter.key}`);

  // await saveCursor(adapter.key, nextCursor ?? null, new Date());

  if (nextCursor) {
    await job.updateProgress({ nextCursor });
    // await job.moveToCompleted('ok', true);
    // enqueue next page immediately
    // await job.queue.add('page', { source: adapter.key, cursor: nextCursor }, { removeOnComplete: 1000 });
  }
}