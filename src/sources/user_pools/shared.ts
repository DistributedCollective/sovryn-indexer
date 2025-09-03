import { and, eq } from 'drizzle-orm';
import { uniqBy, orderBy, last } from 'lodash';

import { db } from '~/database/client';
import {
  NewPoolLiquidityChange,
  NewPoolPosition,
  NewToken,
  poolLiquidityChangesTable,
  poolPositionsTable,
  poolsTable,
  PoolType,
  tokens,
} from '~/database/schema';
import { Context, IngestResult } from '~/domain/types';
import { encode } from '~/utils/encode';
import { logger } from '~/utils/logger';

export enum LiquidityChangeType {
  deposit = 'deposit',
  withdraw = 'withdraw',
}

export type LiquidityChange = {
  id: string;
  identifier: string;
  poolIdentifier: string;
  positionIdentifier: string;
  chainId: number;
  transactionHash: string;
  provider: PoolType;
  type: LiquidityChangeType;
  extra: Record<string, any>;
  user: string;
  token: string;
  amount: string;
  time: Date;
};

export async function ingestLiquidityChanges(items: LiquidityChange[], ctx: Context): Promise<IngestResult> {
  if (items.length === 0) {
    logger.info('No ambient liquidity changes to ingest');
    return { lastTimestamp: null };
  }

  const tokenAddresses = uniqBy(items, 'token');
  const positions = uniqBy(items, 'positionIdentifier');

  await db
    .transaction(async (tx) => {
      // fill with new possibly new data
      await tx
        .insert(tokens)
        .values(
          tokenAddresses.map(
            (item) =>
              ({
                identifier: encode.identity([item.chainId, item.token.toLowerCase()]),
                chainId: item.chainId,
                address: item.token.toLowerCase(),
                processed: false,
              } satisfies NewToken),
          ),
        )
        .onConflictDoNothing();

      await tx
        .insert(poolPositionsTable)
        .values(
          positions.map(
            (position) =>
              ({
                identifier: position.positionIdentifier,
                poolId: position.poolIdentifier,
                chainId: position.chainId,
                user: position.user,
              } satisfies NewPoolPosition),
          ),
        )
        .onConflictDoNothing();

      // insert liquidity changes
      await tx
        .insert(poolLiquidityChangesTable)
        .values(
          items.map(
            (item) =>
              ({
                identifier: item.identifier,
                poolId: item.poolIdentifier,
                positionId: item.positionIdentifier,
                chainId: item.chainId,
                transactionHash: item.transactionHash,
                provider: item.provider,
                type: item.type,
                extra: item.extra,
                user: item.user,
                tokenId: encode.identity([item.chainId, item.token.toLowerCase()]),
                tokenAmount: item.amount,
                createdAt: item.time,
              } satisfies NewPoolLiquidityChange),
          ),
        )
        .onConflictDoNothing();
    })
    .catch((e) => {
      logger.error({ err: e, positions }, 'Error ingesting liquidity changes batch!!!!');
      throw e;
    });

  const lastTimestamp = last(orderBy(items, 'time', 'desc'))?.time ?? null;
  return { lastTimestamp };
}
