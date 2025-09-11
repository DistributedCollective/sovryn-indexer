/* eslint-disable import/order */
import config from '~/config';
import { logger } from './utils/logger';
import '~/utils/shutdown';

import { startApp } from '~/app';
import { startCrontab } from '~/crontab';

startApp();

logger.warn({ env: process.env, config }, `DEBUG ENV`);

if (!config.readOnly) {
  logger.info('Running in read-write mode. Starting crontab...');
  startCrontab();

  if (config.spawnWorkers) {
    logger.info('Spawning worker processes...');
    import('./jobs/worker-spawner');
  } else {
    logger.warn('Worker processes are disabled.');
  }
} else {
  logger.info('Running in read-only mode.');
}
