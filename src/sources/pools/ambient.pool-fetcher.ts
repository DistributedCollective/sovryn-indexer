import { eq } from 'drizzle-orm';
import gql from 'graphql-tag';
import { first, orderBy, uniq, uniqBy } from 'lodash';

import { type SourceAdapter } from '../../domain/types';
import { isSourceInLiveMode } from '../helpers';

import { markTokensAsSwapable } from '~/cronjobs/dex/pools/utils';
import { db } from '~/database/client';
import { poolsRepository } from '~/database/repository/pools-repository';
import { tokenRepository } from '~/database/repository/token-repository';
import { NewPool, NewToken, Pool, poolsTable, PoolType, Token } from '~/database/schema';
import { Chain } from '~/loader/networks/chain-config';
import { SdexChain } from '~/loader/networks/sdex-chain';
import { areAddressesEqual } from '~/utils/compare';
import { encode } from '~/utils/encode';

const LIMIT = 100;

type PoolInfo = {
  base: string;
  quote: string;
  poolIdx: string;
  timeCreate: string;
};

type Query = {
  pools: PoolInfo[];
};

const QUERY = `{
base
quote
poolIdx
timeCreate
}`;

export const ambientPoolFetcherSource: SourceAdapter<PoolInfo> = {
  name: 'ambient_pool_fetcher',
  chains: [
    // bob mainnet
    60808,
    // bob testnet
    808813,
  ],

  enabled: (ctx) => isSourceInLiveMode(encode.identity(['token_fetcher', ctx.chain.chainId])),

  async fetchBackfill(cursor, { chain }) {
    const start = cursor ? parseInt(cursor, 10) : 0;
    const items = await chain.sdex
      .queryFromSubgraph<Query>(
        gql`
          query ($start: Int, $limit: Int) {
            pools(first: $limit, skip: $start, orderBy: timeCreate, orderDirection: asc) ${QUERY}
          }
        `,
        {
          start,
          limit: LIMIT,
        },
      )
      .then((res) => res.pools);

    const nextCursor = items.length >= LIMIT ? String(start + LIMIT) : null;

    return { items, nextCursor, atLiveEdge: nextCursor === null };
  },
  async fetchIncremental(watermark, cursor, { chain }) {
    const start = cursor ? parseInt(cursor, 10) : 0;

    const items = await chain.sdex
      .queryFromSubgraph<Query>(
        gql`
          query ($start: Int, $limit: Int, $watermark: BigInt) {
            pools(
              first: $limit
              skip: $start
              orderBy: timeCreate
              orderDirection: asc
              where: { timeCreate_gte: $watermark }
            ) ${QUERY}
          }
        `,
        {
          start,
          limit: LIMIT,
          watermark: Math.floor(Number(watermark) / 1000),
        },
      )
      .then((res) => res.pools);

    const nextCursor = items.length >= LIMIT ? String(start + LIMIT) : null;

    return { items, nextCursor };
  },
  ingest: async (items, ctx) => {
    if (!items.length) {
      return { highWater: null };
    }

    const newTokens = uniq(items.flatMap((pool) => [pool.base.toLowerCase(), pool.quote.toLowerCase()])).map(
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
      await Promise.allSettled([...inserted.map(updateAmbientLpToken(ctx.chain.sdex)), markTokensAsSwapable(inserted)]);
    }

    const lastTimestamp = first(orderBy(pools, 'createdAt', 'desc'))?.createdAt ?? null;

    return { highWater: lastTimestamp ? lastTimestamp.getTime().toString() : null };
  },
};

function mapItem(pool: PoolInfo, chain: Chain, tokens: Token[]): NewPool {
  const baseId = tokens.find((token) => areAddressesEqual(token.address, pool.base));
  const quoteId = tokens.find((token) => areAddressesEqual(token.address, pool.quote));

  return {
    chainId: chain.chainId,
    type: PoolType.ambient,
    legacyIdentifier: `${pool.base}_${pool.quote}_${pool.poolIdx}`,
    identifier: encode.identity([chain.chainId, PoolType.ambient, pool.base, pool.quote, pool.poolIdx]),
    baseId: baseId.id,
    quoteId: quoteId.id,
    baseIdentifier: encode.tokenId(chain.chainId, pool.base),
    quoteIdentifier: encode.tokenId(chain.chainId, pool.quote),
    extra: {
      poolIdx: Number(pool.poolIdx),
      // lpToken: pool.lpToken, // todo
    },
    processed: true,
    enabled: !(baseId?.ignored || quoteId?.ignored),
    createdAt: new Date(Number(pool.timeCreate) * 1000),
  } satisfies NewPool;
}

const updateAmbientLpToken = (chain: SdexChain) => async (pool: Pool) => {
  const [base, quote, poolIdx] = pool.legacyIdentifier.split('_');
  const lpToken = await chain.query.queryPoolLpTokenAddress(base, quote, poolIdx);
  if (lpToken) {
    await db
      .update(poolsTable)
      .set({ extra: { ...pool.extra, lpToken: lpToken.toLowerCase() } })
      .where(eq(poolsTable.id, pool.id));
  }
};
