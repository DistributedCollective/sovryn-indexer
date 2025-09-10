import dayjs from 'dayjs';
import { eq } from 'drizzle-orm';
import gql from 'graphql-tag';
import _ from 'lodash';
import { bignumber } from 'mathjs';

import { markTokensAsSwapable } from './utils';

import { MAX_DECIMAL_PLACES } from '~/config/constants';
import { db } from '~/database/client';
import { PoolExtended } from '~/database/repository/pools-repository';
import { poolsTable } from '~/database/schema';
import { networks } from '~/loader/networks';
import { LegacyChain } from '~/loader/networks/legacy-chain';
import { areAddressesEqual } from '~/utils/compare';
import { logger } from '~/utils/logger';
import { prettyNumber } from '~/utils/numbers';

const childLogger = logger.child({ module: 'crontab:dex:pools:bancor' });

export const updateBancorPool = async (pool: PoolExtended) => {
  const chain = networks.getByChainId(pool.chainId);
  const result = await getPoolData(chain.legacy, pool.identifier);

  const baseConnector = result.connectorTokens.find((item) => areAddressesEqual(item.token.id, pool.base.address));
  const quoteConnector = result.connectorTokens.find((item) => areAddressesEqual(item.token.id, pool.quote.address));

  if (!baseConnector || !quoteConnector) {
    childLogger.error(`Connector token not found for pool ${pool.id}`);
    return;
  }

  const fee = bignumber(result.conversionFee).lte(0)
    ? '0'
    : prettyNumber(bignumber(result.conversionFee).div(result.maxConversionFee).mul(100));
  const price = bignumber(baseConnector.token.lastPriceUsd).div(quoteConnector.token.lastPriceUsd);

  const isToken0Base = areAddressesEqual(pool.base.address, result.token0.id);
  const baseLiquidity = isToken0Base ? result.token0Balance : result.token1Balance;
  const quoteLiquidity = isToken0Base ? result.token1Balance : result.token0Balance;

  const dailyVolumes = result.conversions.reduce(
    (acc, item) => {
      const fromBase = areAddressesEqual(item.conversion._fromToken.id, pool.base.address);
      return {
        base: acc.base.add(fromBase ? item.conversion._amount : item.conversion._return),
        quote: acc.quote.add(fromBase ? item.conversion._return : item.conversion._amount),
      };
    },
    { base: bignumber(0), quote: bignumber(0) },
  );

  await db
    .update(poolsTable)
    .set({
      fee,
      // printing with 18 decimals in case we will need precision for some calculations on FE side.
      price: prettyNumber(price, MAX_DECIMAL_PLACES),
      baseLiquidity: prettyNumber(baseLiquidity, MAX_DECIMAL_PLACES),
      quoteLiquidity: prettyNumber(quoteLiquidity, MAX_DECIMAL_PLACES),
      baseVolume: prettyNumber(baseConnector.totalVolume),
      quoteVolume: prettyNumber(quoteConnector.totalVolume),
      dailyBaseVolume: prettyNumber(dailyVolumes.base),
      dailyQuoteVolume: prettyNumber(dailyVolumes.quote),
      // mark as just processed to avoid reprocessing
      processedAt: new Date(),
    })
    .where(eq(poolsTable.id, pool.id));

  // todo: remove this once confirmed that tokens are updated correctly on pool creation step.
  await markTokensAsSwapable([pool]);
};

type GetPoolData = {
  liquidityPool: {
    token0: {
      id: string;
    };
    token1: {
      id: string;
    };
    token0Balance: string;
    token1Balance: string;
    connectorTokens: {
      token: {
        id: string;
        lastPriceUsd: string;
      };
      totalVolume: string;
    }[];
    conversions: {
      conversion: {
        _fromToken: {
          id: string;
        };
        _toToken: {
          id: string;
        };
        _amount: string;
        _return: string;
      };
    }[];
    conversionFee: string;
    maxConversionFee: string;
  };
};

async function getPoolData(chain: LegacyChain, id: string) {
  return chain
    .queryFromSubgraph<GetPoolData>(
      gql`
        query {
          liquidityPool(id: "${id}") {
            token0 {
              id
            }
            token1 {
              id
            }
            token0Balance
            token1Balance
            connectorTokens {
              token {
                id
                lastPriceUsd
              }
              totalVolume
            }
            conversions(where: { timestamp_gt: ${dayjs().subtract(1, 'days').unix()} }) {
              conversion {
                _fromToken {
                  id
                }
                _toToken {
                  id
                }
                _amount
                _return
              }
            }
            conversionFee
            maxConversionFee
          }
        }
      `,
    )
    .then((data) => data.liquidityPool);
}
