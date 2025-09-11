import path from 'node:path';

import { Worker } from 'bullmq';

import { INGEST_QUEUE_NAME, redisConnection } from './worker-config';

import { logger } from '~/utils/logger';
import { onShutdown } from '~/utils/shutdown';

logger.info('Spawning ingest worker.');

const ingestWorker = new Worker(INGEST_QUEUE_NAME, path.resolve(__dirname, `workers/ingest/worker.js`), {
  connection: redisConnection,
  useWorkerThreads: true,
  removeOnComplete: {
    age: 3600, // keep for 1 hour
    count: 100, // keep last 100 completed jobs
  },
  removeOnFail: {
    age: 86400, // keep for 1 day
    count: 1000,
  },
  concurrency: 4,
  autorun: true,
});

onShutdown(async () => {
  logger.info('Shutting down ingest worker.');
  await ingestWorker.close();
});
