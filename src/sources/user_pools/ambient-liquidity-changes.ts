import gql from 'graphql-tag';
import { bignumber } from 'mathjs';

import type { SourceAdapter } from '../../domain/types';

import { ingestLiquidityChanges, LiquidityChange, LiquidityChangeType } from './shared';

import { PoolType } from '~/database/schema';
import { Chain } from '~/loader/networks/chain-config';
import { encode } from '~/utils/encode';
import { logger } from '~/utils/logger';

const LIMIT = 1000;

type Query = {
  liquidityChanges: {
    id: string;
    transactionHash: string;
    pool: {
      base: string;
      quote: string;
      poolIdx: string;
    };
    user: string;
    positionType: 'ambient' | 'concentrated';
    changeType: 'mint' | 'burn';
    time: string;
    bidTick: number;
    askTick: number;
    isBid: boolean;
    liq: string;
    baseFlow: string;
    quoteFlow: string;
  }[];
};

export const ambientUserPoolProvider: SourceAdapter<LiquidityChange> = {
  name: 'ambient_liquidity_changes',
  chains: [
    // bob mainnet
    60808,
    // bob testnet
    808813,
  ],

  async fetchBackfill(cursor, { chain }) {
    const start = cursor ? parseInt(cursor, 10) : 0;
    const result = await chain.sdex
      .queryFromSubgraph<Query>(
        gql`
          query ($start: Int, $limit: Int) {
            liquidityChanges(first: $limit, skip: $start, orderBy: block, orderDirection: asc) {
              id
              transactionHash
              pool {
                base
                quote
                poolIdx
              }
              user
              time
              positionType
              changeType
              bidTick
              askTick
              isBid
              liq
              baseFlow
              quoteFlow
            }
          }
        `,
        {
          start,
          limit: LIMIT,
        },
      )
      .then((res) => res.liquidityChanges);

    const items = result.flatMap((change) => mapItem(change, chain));
    const nextCursor = items.length >= LIMIT ? String(start + LIMIT) : null;

    return { items, nextCursor, atLiveEdge: nextCursor === null };
  },
  async fetchIncremental(watermark, cursor, { chain }) {
    const start = cursor ? parseInt(cursor, 10) : 0;
    const result = await chain.sdex
      .queryFromSubgraph<Query>(
        gql`
          query ($start: Int, $limit: Int, $watermark: BigInt) {
            liquidityChanges(
              first: $limit
              skip: $start
              orderBy: block
              orderDirection: asc
              where: { time_gte: $watermark }
            ) {
              id
              transactionHash
              pool {
                base
                quote
                poolIdx
              }
              user
              time
              positionType
              changeType
              bidTick
              askTick
              isBid
              liq
              baseFlow
              quoteFlow
            }
          }
        `,
        {
          start,
          limit: LIMIT,
          watermark,
        },
      )
      .then((res) => res.liquidityChanges);

    const items = result.flatMap((change) => mapItem(change, chain));

    const nextCursor = items.length >= LIMIT ? String(start + LIMIT) : null;

    return { items, nextCursor };
  },
  ingest: (items, ctx) => ingestLiquidityChanges(items, ctx),
};

function mapItem(item: Query['liquidityChanges'][0], chain: Chain): LiquidityChange[] {
  const data = {
    id: item.id,
    provider: PoolType.ambient,
    chainId: chain.chainId,
    transactionHash: item.transactionHash,
    type: item.changeType === 'mint' ? LiquidityChangeType.deposit : LiquidityChangeType.withdraw,
    poolIdentifier: encode.identity([
      chain.chainId,
      PoolType.ambient,
      item.pool.base.toLowerCase(),
      item.pool.quote.toLowerCase(),
      item.pool.poolIdx,
    ]),
    positionIdentifier: encode.identity([
      chain.chainId,
      item.pool.base,
      item.pool.quote,
      item.pool.poolIdx,
      item.positionType,
      item.askTick,
      item.bidTick,
    ]),
    user: item.user,
    time: new Date(Number(item.time) * 1000),
    extra: {
      sourceId: item.id,
      base: item.pool.base,
      quote: item.pool.quote,
      poolIdx: item.pool.poolIdx,
      liq: item.liq,
      bidTick: item.bidTick,
      askTick: item.askTick,
      isBid: item.isBid,
      positionType: item.positionType,
    },
  } satisfies Omit<LiquidityChange, 'identifier' | 'token' | 'amount'>;

  const items: LiquidityChange[] = [];

  if (item.baseFlow && item.baseFlow !== '0') {
    items.push({
      ...data,
      identifier: encode.identity([chain.chainId, 'ambient:liquidity_change', item.id, item.pool.base]),
      token: item.pool.base,
      amount: bignumber(item.baseFlow).abs().toString(),
    });
  }

  if (item.quoteFlow && item.quoteFlow !== '0') {
    items.push({
      ...data,
      identifier: encode.identity([chain.chainId, 'ambient:liquidity_change', item.id, item.pool.quote]),
      token: item.pool.quote,
      amount: bignumber(item.quoteFlow).abs().toString(),
    });
  }

  return items;
}
