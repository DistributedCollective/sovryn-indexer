import { Queue } from 'bullmq';

import { INGEST_QUEUE_NAME, redisConnection } from './worker-config';
import { IngestWorkerType } from './workers/ingest/types';

export const ingestQueue = new Queue<IngestWorkerType>(INGEST_QUEUE_NAME, { connection: redisConnection });
