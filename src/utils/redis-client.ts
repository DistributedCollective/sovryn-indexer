import { Redis } from 'ioredis';

import { logger } from './logger';
import { onShutdown } from './shutdown';

import config from '~/config';

export const redis = new Redis(config.redisCacheUrl, { maxRetriesPerRequest: null })
  .on('connect', () => {
    logger.info('Redis client connected');
  })
  .on('error', (err) => {
    logger.warn(err, 'Redis error');
  });

onShutdown(async () => {
  await redis.disconnect();
});
