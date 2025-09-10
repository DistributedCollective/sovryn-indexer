import dayjs from 'dayjs';
import { and, eq, gte, sql, sum } from 'drizzle-orm';
import _ from 'lodash';
import { bignumber } from 'mathjs';

import { getPoolStats, markTokensAsSwapable } from './utils';

import { MAX_DECIMAL_PLACES } from '~/config/constants';
import { db } from '~/database/client';
import { PoolExtended } from '~/database/repository/pools-repository';
import { poolsTable, swapsTableV2 } from '~/database/schema';
import { networks } from '~/loader/networks';
import { SdexChain } from '~/loader/networks/sdex-chain';
import { prettyNumber } from '~/utils/numbers';
import { toDisplayPrice } from '~/utils/price';

export const updateAmbientPool = async (pool: PoolExtended) => {
  const chain = networks.getByChainId(pool.chainId);
  const stats = await getPoolStats(chain.chainIdHex, pool.base.address, pool.quote.address, pool.extra.poolIdx);

  const displayPrice = toDisplayPrice(stats.lastPriceIndic, pool.base.decimals, pool.quote.decimals, true);

  const daily = await getDailyPoolVolume(chain.sdex, pool);

  await db
    .update(poolsTable)
    .set({
      fee: prettyNumber(bignumber(stats.feeRate).mul(100)),
      // printing with 18 decimals in case we will need precision for some calculations on FE side.
      price: prettyNumber(displayPrice, MAX_DECIMAL_PLACES),
      baseLiquidity: prettyNumber(bignumber(stats.baseTvl).div(10 ** pool.base.decimals), MAX_DECIMAL_PLACES),
      quoteLiquidity: prettyNumber(bignumber(stats.quoteTvl).div(10 ** pool.quote.decimals), MAX_DECIMAL_PLACES),
      baseVolume: prettyNumber(bignumber(stats.baseVolume).div(10 ** pool.base.decimals)),
      quoteVolume: prettyNumber(bignumber(stats.quoteVolume).div(10 ** pool.quote.decimals)),
      dailyBaseVolume: prettyNumber(bignumber(daily.baseVolume)),
      dailyQuoteVolume: prettyNumber(bignumber(daily.quoteVolume)),
      // mark as just processed to avoid reprocessing
      processedAt: new Date(),
    })
    .where(eq(poolsTable.id, pool.id));

  // temporary solution to mark tokens as swapable after pool update
  // todo: remove after first run, because it was supposed to be run only once when pool is first created
  await markTokensAsSwapable([pool]);
};

// build query to get volume of the pool for the last 24 hours
export const getDailyPoolVolume = async (chain: SdexChain, pool: PoolExtended) => {
  const date = dayjs().subtract(1, 'days').toDate();
  const baseVolume = await db
    .select({
      volume: sum(sql`${swapsTableV2.baseAmount}::numeric`).as('volume'),
    })
    .from(swapsTableV2)
    .where(and(eq(swapsTableV2.poolId, pool.id), eq(swapsTableV2.baseId, pool.baseId), gte(swapsTableV2.tickAt, date)))
    .groupBy(swapsTableV2.poolId)
    .then((rows) => (rows.length ? rows[0] : { volume: '0' }));

  const quoteVolume = await db
    .select({
      volume: sum(sql`${swapsTableV2.quoteAmount}::numeric`).as('volume'),
    })
    .from(swapsTableV2)
    .where(
      and(eq(swapsTableV2.poolId, pool.id), eq(swapsTableV2.quoteId, pool.quoteId), gte(swapsTableV2.tickAt, date)),
    )
    .groupBy(swapsTableV2.poolId)
    .then((rows) => (rows.length ? rows[0] : { volume: '0' }));

  return {
    baseVolume: baseVolume.volume,
    quoteVolume: quoteVolume.volume,
  };
};
