/* eslint-disable import/order */
import config from '~/config';
import { logger } from './utils/logger';
import '~/utils/shutdown';

import { startApp } from '~/app';
import { startCrontab } from '~/crontab';

startApp();

if (!config.readOnly) {
  logger.info('Running in read-write mode. Starting crontab...');
  startCrontab();

  if (config.spawnWorkers) {
    import('./jobs/worker-spawner');
  }
} else {
  logger.info('Running in read-only mode.');
}
