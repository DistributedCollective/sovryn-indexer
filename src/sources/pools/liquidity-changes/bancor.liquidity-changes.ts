import gql from 'graphql-tag';
import { bignumber } from 'mathjs';

import { ingestLiquidityChanges, LiquidityChange, LiquidityChangeType } from '../shared';

import { PoolType } from '~/database/schema';
import { HighWaterMark, SourceAdapter } from '~/domain/types';
import { Chain } from '~/loader/networks/chain-config';
import { isSourceInLiveMode } from '~/sources/helpers';
import { encode } from '~/utils/encode';

const LIMIT = 1000;

type Query = {
  liquidityHistoryItems: {
    id: string;
    type: 'Added' | 'Removed';
    amount: string;
    timestamp: number;
    user: {
      id: string;
    };
    reserveToken: {
      id: string;
      decimals: number;
    };
    liquidityPool: {
      id: string;
      token0: {
        id: string;
        decimals: number;
      };
      token1: {
        id: string;
        decimals: number;
      };
    };
    transaction: {
      id: string;
    };
  }[];
};

const QUERY = `{
id
type
amount
timestamp
reserveToken {
  id
  decimals
}
user {
  id
}
liquidityPool {
  id
  token0 {
    id
    decimals
  }
  token1 {
    id
    decimals
  }
}
transaction {
  id
}
}`;

export const bancorPoolLiquidityChangesSource: SourceAdapter<LiquidityChange> = {
  name: 'bancor_liquidity_changes',
  chains: [
    // rsk mainnet
    30,
    // rsk testnet
    31,
  ],
  highWaterMark: HighWaterMark.date,
  highWaterOverlapWindow: 172800, // 48 hours

  // disable until tokens and pools for specific chain are synced to live mode
  enabled: async (ctx) =>
    (await isSourceInLiveMode(encode.identity(['token_fetcher', ctx.chain.chainId]))) &&
    (await isSourceInLiveMode(encode.identity(['bancor_pool_fetcher', ctx.chain.chainId]))),

  async fetchBackfill(cursor, { chain }) {
    const start = cursor ? parseInt(cursor, 10) : 0;
    const result = await chain.legacy
      .queryFromSubgraph<Query>(
        gql`
          query ($start: Int, $limit: Int) {
            liquidityHistoryItems(first: $limit, skip: $start, orderBy: timestamp, orderDirection: asc) ${QUERY}
          }
        `,
        {
          start,
          limit: LIMIT,
        },
      )
      .then((res) => res.liquidityHistoryItems);

    const items = result.map((change) => mapItem(change, chain));
    const nextCursor = items.length >= LIMIT ? String(start + LIMIT) : null;

    return { items, nextCursor, atLiveEdge: nextCursor === null };
  },
  async fetchIncremental(watermark, cursor, { chain }) {
    const start = cursor ? parseInt(cursor, 10) : 0;
    const result = await chain.legacy
      .queryFromSubgraph<Query>(
        gql`
          query ($start: Int, $limit: Int, $watermark: Int) {
            liquidityHistoryItems(
              first: $limit
              skip: $start
              orderBy: timestamp
              orderDirection: asc
              where: { timestamp_gte: $watermark }
            ) ${QUERY}
          }
        `,
        {
          start,
          limit: LIMIT,
          watermark: Math.floor(Number(watermark) / 1000),
        },
      )
      .then((res) => res.liquidityHistoryItems);

    const items = result.map((change) => mapItem(change, chain));

    const nextCursor = items.length >= LIMIT ? String(start + LIMIT) : null;
    return { items, nextCursor };
  },
  ingest: (items, ctx) => ingestLiquidityChanges(items, ctx),
};

function mapItem(item: Query['liquidityHistoryItems'][0], chain: Chain): LiquidityChange {
  return {
    id: item.id,
    provider: PoolType.bancor,
    chainId: chain.chainId,
    transactionHash: item.transaction.id,
    type: item.type === 'Added' ? LiquidityChangeType.deposit : LiquidityChangeType.withdraw,
    poolIdentifier: encode.identity([chain.chainId, PoolType.bancor, item.liquidityPool.id.toLowerCase()]),
    positionIdentifier: encode.identity([
      chain.chainId,
      PoolType.bancor,
      item.liquidityPool.id.toLowerCase(),
      item.user.id.toLowerCase(),
    ]),
    identifier: encode.identity([chain.chainId, 'bancor:liquidity_change', item.id]),
    user: item.user.id.toLowerCase(),
    time: new Date(item.timestamp * 1000),
    token: item.reserveToken.id.toLowerCase(),
    amount: bignumber(item.amount).mul(bignumber(10).pow(item.reserveToken.decimals)).toString(),
    extra: {
      sourceId: item.id,
    },
  } satisfies LiquidityChange;
}
