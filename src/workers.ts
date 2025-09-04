import { spawnWorkers } from './jobs/worker-spawner';
import { logger } from './utils/logger';

logger.info('Starting workers...');

spawnWorkers();
