import IORedis from 'ioredis';
import config from "~/config";

export const redisConnection = new IORedis(config.redisCacheUrl, { maxRetriesPerRequest: null });

export const INGEST_QUEUE_NAME = 'ingest';
