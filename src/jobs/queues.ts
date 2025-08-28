import { Queue, Worker } from 'bullmq';
import config from '~/config';
import IORedis from 'ioredis';
import path from 'path';
import { logger } from '~/utils/logger';

const connection = new IORedis(config.redisCacheUrl, { maxRetriesPerRequest: null});

export const ingestQueue = new Queue<{ source: string; cursor?: string | null }>('ingest', { connection });

new Worker('ingest', path.resolve(__dirname, `workers/ingest.worker.js`), {
  connection, concurrency: 4, useWorkerThreads: true,
});


logger.info('Queues initialized');