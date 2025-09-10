import { CronJob } from 'cron';
import _ from 'lodash';

import { updateAmbientPool } from './ambient-pool-tasks';
import { updateBancorPool } from './bancor-pool-tasks';

import { PoolExtended, poolsRepository } from '~/database/repository/pools-repository';
import { PoolType } from '~/database/schema';
import { logger } from '~/utils/logger';

const childLogger = logger.child({ module: 'crontab:dex:pool_list' });

// to populate database with pool data (liquidity, volume, etc)
export const updateDexPoolListData = async (ctx: CronJob) => {
  try {
    ctx.stop();
    childLogger.info('Updating pool info...');

    const items = await poolsRepository.allProcessable();

    childLogger.info(`Found ${items.length} pools to update`);

    await Promise.allSettled(items.map(choosePoolHandler));

    childLogger.info('Pool update finished.');
  } catch (e) {
    childLogger.error({ error: e.message }, 'Error updating pools');
  } finally {
    ctx.start();
  }
};

async function choosePoolHandler(pool: PoolExtended) {
  switch (pool.type) {
    case PoolType.ambient:
      return updateAmbientPool(pool);
    case PoolType.bancor:
      return updateBancorPool(pool);
    default:
      return Promise.reject(new Error(`Don't know how to process: ${pool.type}`));
  }
}
