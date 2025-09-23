import { Queue } from 'bullmq';

import { INGEST_QUEUE_NAME } from './worker-config';
import { IngestWorkerType } from './workers/ingest/types';

import { redis } from '~/utils/redis-client';

export const ingestQueue = new Queue<IngestWorkerType>(INGEST_QUEUE_NAME, { connection: redis });
