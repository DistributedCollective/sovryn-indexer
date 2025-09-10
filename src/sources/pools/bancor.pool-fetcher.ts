import gql from 'graphql-tag';
import { first, orderBy, uniq } from 'lodash';
import { bignumber } from 'mathjs';

import { type SourceAdapter } from '../../domain/types';
import { isSourceInLiveMode } from '../helpers';

import { markTokensAsSwapable } from '~/cronjobs/dex/pools/utils';
import { poolsRepository } from '~/database/repository/pools-repository';
import { tokenRepository } from '~/database/repository/token-repository';
import { NewPool, NewToken, PoolType, Token } from '~/database/schema';
import { Chain } from '~/loader/networks/chain-config';
import { areAddressesEqual } from '~/utils/compare';
import { encode } from '~/utils/encode';
import { prettyNumber } from '~/utils/numbers';

const LIMIT = 100;

type PoolInfo = {
  id: string;
  type: number;
  version: number;
  smartToken: {
    id: string;
  };
  token0: {
    id: string;
  };
  token1: {
    id: string;
  };
  conversionFee: string;
  maxConversionFee: string;
  createdAtTimestamp: number;
  activated: boolean;
};

type Query = {
  liquidityPools: PoolInfo[];
};

const QUERY = `{
  id
  type
  version
  smartToken {
    id
  }
  token0 {
    id
  }
  token1 {
    id
  }
  conversionFee
  maxConversionFee
  createdAtTimestamp
  activated
}`;

export const bancorPoolFetcherSource: SourceAdapter<PoolInfo> = {
  name: 'bancor_pool_fetcher',
  chains: [
    // rsk mainnet
    30,
    // rsk testnet
    31,
  ],

  enabled: (ctx) => isSourceInLiveMode(encode.identity(['token_fetcher', ctx.chain.chainId])),

  async fetchBackfill(cursor, { chain }) {
    const start = cursor ? parseInt(cursor, 10) : 0;
    const items = await chain.legacy
      .queryFromSubgraph<Query>(
        gql`
          query ($start: Int, $limit: Int) {
            liquidityPools(first: $limit, skip: $start, orderBy: createdAtTimestamp, orderDirection: asc) ${QUERY}
          }
        `,
        {
          start,
          limit: LIMIT,
        },
      )
      .then((res) => res.liquidityPools);

    const nextCursor = items.length >= LIMIT ? String(start + LIMIT) : null;

    return { items, nextCursor, atLiveEdge: nextCursor === null };
  },
  async fetchIncremental(watermark, cursor, { chain }) {
    const start = cursor ? parseInt(cursor, 10) : 0;

    const items = await chain.legacy
      .queryFromSubgraph<Query>(
        gql`
          query ($start: Int, $limit: Int, $watermark: Int) {
            liquidityPools(
              first: $limit
              skip: $start
              orderBy: createdAtTimestamp
              orderDirection: asc
              where: { createdAtTimestamp_gte: $watermark }
            ) ${QUERY}
          }
        `,
        {
          start,
          limit: LIMIT,
          watermark: Math.floor(Number(watermark) / 1000),
        },
      )
      .then((res) => res.liquidityPools);

    const nextCursor = items.length >= LIMIT ? String(start + LIMIT) : null;

    return { items, nextCursor };
  },
  ingest: async (entry, ctx) => {
    if (!entry.length) {
      return { highWater: null };
    }

    // disabled bancor pools may have tokens unset
    const items = entry.filter((pool) => pool.token0?.id && pool.token1?.id);

    const newTokens = uniq(items.flatMap((pool) => [pool.token0.id.toLowerCase(), pool.token1.id.toLowerCase()])).map(
      (token) =>
        ({
          address: token,
          chainId: ctx.chain.chainId,
          processed: false,
          ignored: true,
        } satisfies NewToken),
    );
    await tokenRepository.insertTokens(newTokens, true);

    const tokens = await tokenRepository.listAllForChain(ctx.chain.chainId);
    const pools = items.map((pool) => mapItem(pool, ctx.chain, tokens));

    const inserted = await poolsRepository.insertPools(pools);

    if (inserted.length) {
      await markTokensAsSwapable(inserted);
    }

    const lastTimestamp = first(orderBy(pools, 'createdAt', 'desc'))?.createdAt ?? null;

    return { highWater: lastTimestamp ? lastTimestamp.getTime().toString() : null };
  },
};

function mapItem(pool: PoolInfo, chain: Chain, tokens: Token[]): NewPool {
  const baseId = tokens.find((token) => areAddressesEqual(token.address, pool.token0.id));
  const quoteId = tokens.find((token) => areAddressesEqual(token.address, pool.token1.id));

  return {
    chainId: chain.chainId,
    type: PoolType.bancor,
    legacyIdentifier: pool.id,
    identifier: encode.identity([chain.chainId, PoolType.bancor, pool.id.toLowerCase()]),
    baseId: baseId.id,
    quoteId: quoteId.id,
    baseIdentifier: encode.tokenId(chain.chainId, pool.token0.id),
    quoteIdentifier: encode.tokenId(chain.chainId, pool.token1.id),
    fee: bignumber(pool.conversionFee).lte(0)
      ? '0'
      : prettyNumber(bignumber(pool.conversionFee).div(pool.maxConversionFee).mul(100)),
    extra: {
      type: pool.type, // 1 or 2
      version: pool.version ?? null,
      smartToken: pool.smartToken?.id ?? null,
    },
    processed: true,
    enabled: !(baseId?.ignored || quoteId?.ignored) && pool.activated,
    createdAt: new Date(Number(pool.createdAtTimestamp) * 1000),
  } satisfies NewPool;
}
