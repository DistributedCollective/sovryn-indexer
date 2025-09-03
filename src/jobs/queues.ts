import { Queue, QueueEvents } from 'bullmq';

import { INGEST_QUEUE_NAME, redisConnection } from './worker-config';
import { IngestWorkerType } from './workers/ingest/types';

import { logger } from '~/utils/logger';

export const ingestQueue = new Queue<IngestWorkerType>(INGEST_QUEUE_NAME, { connection: redisConnection });

const events = new QueueEvents(INGEST_QUEUE_NAME, { connection: redisConnection });

events.on('deduplicated', (e) => {
  logger.info({ job: e }, `Job ${e.jobId} was deduplicated`);
});
