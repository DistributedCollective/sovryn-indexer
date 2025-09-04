import path from 'node:path';
import { Worker } from 'bullmq';
import { INGEST_QUEUE_NAME, redisConnection } from './worker-config';
import { onShutdown } from '~/utils/shutdown';

const ingestWorker = new Worker(INGEST_QUEUE_NAME, path.resolve(__dirname, `workers/ingest/worker.js`), {
  connection: redisConnection,
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

export const spawnWorkers = () => {
  ingestWorker.run();
};

onShutdown(async () => {
  await ingestWorker.close();
});
