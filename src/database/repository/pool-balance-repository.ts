import { eq, and, desc, inArray } from 'drizzle-orm';

import { db } from 'database/client';
import { poolsTable } from 'database/schema';
import { NewPoolBalance, poolBalanceTable } from 'database/schema/pool-balance';

export type PoolBalanceItem = Omit<NewPoolBalance, 'createdAt' | 'updatedAt'>;

export const poolBalanceRepository = {
  create: (data: PoolBalanceItem[]) =>
    db.insert(poolBalanceTable).values(data).returning({ id: poolBalanceTable.id }).execute(),

  loadAll: (chainId?: number) =>
    db
      .select({
        id: poolBalanceTable.id,
        poolId: poolBalanceTable.poolId,
        user: poolBalanceTable.user,
        time: poolBalanceTable.time,
        baseQty: poolBalanceTable.baseQty,
        quoteQty: poolBalanceTable.quoteQty,
        extra: poolsTable.extra,
        block: poolBalanceTable.block,
      })
      .from(poolBalanceTable)
      .innerJoin(poolsTable, eq(poolBalanceTable.poolId, poolsTable.id))
      .where(and(chainId ? eq(poolBalanceTable.chainId, chainId) : undefined)),

  loadUserBalances: (user: string, chainId?: number) =>
    db
      .select()
      .from(poolBalanceTable)
      .where(and(eq(poolBalanceTable.user, user), chainId ? eq(poolBalanceTable.chainId, chainId) : undefined)),

  loadUsersBalances: (users: string[], chainId?: number) =>
    db
      .select()
      .from(poolBalanceTable)
      .where(and(inArray(poolBalanceTable.user, users), chainId ? eq(poolBalanceTable.chainId, chainId) : undefined)),

  loadLastBalance: (chainId?: number) =>
    db.query.poolBalanceTable.findFirst({
      where: and(chainId ? eq(poolBalanceTable.chainId, chainId) : undefined),
      orderBy: desc(poolBalanceTable.block),
    }),

  removeOldPositions: (chainId: number, users: string[]) =>
    db
      .delete(poolBalanceTable)
      // TODO: Do not remove type order book
      .where(and(eq(poolBalanceTable.chainId, chainId), inArray(poolBalanceTable.user, users)))
      .execute(),
};
