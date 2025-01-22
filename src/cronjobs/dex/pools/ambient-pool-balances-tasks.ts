import { CronJob } from 'cron';

import { poolBalanceRepository } from 'database/repository/pool-balance-repository';
import { poolsRepository } from 'database/repository/pools-repository';
import { networks } from 'loader/networks';
import { SdexChain } from 'loader/networks/sdex-chain';
import { NetworkFeature } from 'loader/networks/types';
import { logger } from 'utils/logger';

const childLogger = logger.child({ module: 'crontab:dex:pools:ambient' });

// to populate database with pools balances
export const updateDexPoolBalances = async (ctx: CronJob) => {
  try {
    childLogger.info('Updating pool balances...');

    const items = networks.listChains();

    for (const item of items) {
      await Promise.allSettled([
        item.hasFeature(NetworkFeature.sdex) && prepareAmbientPoolBalances(item.sdex, item.chainId),
      ]);
    }

    childLogger.info('Pool balances update finished.');
  } catch (e) {
    childLogger.error({ error: e.message }, 'Error retrieving pools');
  } finally {
    ctx.start();
  }
  ctx.stop();
};

export const prepareAmbientPoolBalances = async (chain: SdexChain, chainId: number) => {
  try {
    const blockNumber = await chain.queryBlockNumber();
    const lastBalance = await poolBalanceRepository.loadLastBalance(chainId);

    childLogger.info('lastBalance:', lastBalance);

    if (!lastBalance || lastBalance.block < blockNumber) {
      const newLiqudityChanges = await chain.queryLquidityChanges(lastBalance?.block || 0);

      // list of users that their positions has changed. (deposited / withdrawn)
      const users = newLiqudityChanges.map((item) => item.user).filter((item, pos, self) => self.indexOf(item) == pos);

      //Remove old balances
      await poolBalanceRepository.removeOldPositions(chainId, users);

      const newPositions = await chain.queryPositions(users);

      const pools = await poolsRepository.listForChain(chainId);

      const getPool = (base: string, quote: string) =>
        pools.find(
          (pool) =>
            pool.base.address.toLowerCase() === base.toLowerCase() &&
            pool.quote.address.toLowerCase() === quote.toLowerCase(),
        );

      poolBalanceRepository.create(
        newPositions.map((position) => ({
          user: position.user,
          chainId: chainId,
          identifier: `${position.positionType}-${position.pool.poolIdx}-${position.pool.base}-${position.pool.quote}`,
          poolId: getPool(position.base, position.quote)?.id || 0,
          baseQty: position.baseQty,
          quoteQty: position.quoteQty,
          block: Number(position.block),
          extra: {
            ambientLiq: position.ambientLiq,
            concLiq: position.concLiq,
            rewardLiq: position.rewardLiq,
            aggregatedLiquidity: position.aggregatedLiquidity,
            aggregatedBaseFlow: position.aggregatedBaseFlow,
            aggregatedQuoteFlow: position.aggregatedQuoteFlow,
            positionType: position.positionType,
            bidTick: position.bidTick,
            askTick: position.askTick,
            aprDuration: position.aprDuration,
            aprPostLiq: position.aprPostLiq,
            aprContributedLiq: position.aprContributedLiq,
            aprEst: position.aprEst,
          },
        })),
      );
    }
  } catch (error) {
    childLogger.error(error, 'Error while preparing ambient pool balances', error);
  }
};
