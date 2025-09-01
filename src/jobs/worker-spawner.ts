import path from 'node:path';
import { Worker } from 'bullmq';
import { INGEST_QUEUE_NAME, redisConnection } from './worker-config';
import { logger } from '~/utils/logger';
import { onShutdown } from '~/utils/shutdown';

const ingestWorker = new Worker(INGEST_QUEUE_NAME, path.resolve(__dirname, `workers/ingest/worker.js`), {
  connection: redisConnection,
  concurrency: 4,
  useWorkerThreads: true,
  autorun: false,
  removeOnComplete: {
    age: 3600, // keep for 1 hour
    count: 100, // keep last 100 completed jobs
  },
  removeOnFail: {
    age: 86400, // keep for 1 day
    count: 1000,
  },
});

ingestWorker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed for source ${job.data.source}`);
});

ingestWorker.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed for source ${job.data.source}: ${err.message}`);
});

export const spawnWorkers = () => {
  ingestWorker.run();
};

onShutdown(async () => {
  await ingestWorker.close();
});
