import { uniqBy, orderBy, first } from 'lodash';

import { db } from '~/database/client';
import {
  NewPoolLiquidityChange,
  NewPoolPosition,
  NewToken,
  poolLiquidityChangesTable,
  poolPositionsTable,
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

const log = logger.child({ module: 'pool_liquidity_changes', helper: 'ingestLiquidityChanges' });

export async function ingestLiquidityChanges(items: LiquidityChange[], ctx: Context): Promise<IngestResult> {
  if (items.length === 0) {
    log.info({ ctx }, 'no liquidity changes to ingest');
    return { highWater: null };
  }

  const tokenAddresses = uniqBy(items, 'token');
  const positions = uniqBy(items, 'positionIdentifier');

  const result = await db
    .transaction(async (tx) => {
      // fill with new possibly new data
      const newTokens = await tx
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
        .onConflictDoNothing()
        .returning({ id: tokens.identifier })
        .execute();

      const newPositions = await tx
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
        .onConflictDoNothing()
        .returning({ id: poolPositionsTable.identifier })
        .execute();

      // insert liquidity changes
      const newChanges = await tx
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
        .onConflictDoNothing()
        .returning({ id: poolLiquidityChangesTable.identifier })
        .execute();

      return {
        newTokens,
        newPositions,
        newChanges,
      };
    })
    .catch((e) => {
      log.error({ err: e, ctx, items: items.length }, 'error: ingestLiquidityChanges db transaction');
      throw e;
    });

  const lastTimestamp = first(orderBy(items, 'time', 'desc'))?.time ?? null;

  return { highWater: lastTimestamp ? lastTimestamp.getTime().toString() : null };
}
