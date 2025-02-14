import dayjs from 'dayjs';
import { eq, and, gte, desc } from 'drizzle-orm';

import { db } from 'database/client';

import { swapsTableV2, NewSwapV2 } from './../schema/swaps_v2';

export type NewSwapItem = Omit<NewSwapV2, 'createdAt' | 'updatedAt'>;

export const swapRepositoryV2 = {
  create: (data: NewSwapItem[]) => db.insert(swapsTableV2).values(data).onConflictDoNothing(),

  loadAll: async (chainId?: number) => {
    return await db
      .select({
        chainId: swapsTableV2.chainId,
        transactionHash: swapsTableV2.transactionHash,
        baseAmount: swapsTableV2.baseAmount,
        quoteAmount: swapsTableV2.quoteAmount,
        fees: swapsTableV2.fees,
        callIndex: swapsTableV2.callIndex,
        baseId: swapsTableV2.baseId,
        quoteId: swapsTableV2.quoteId,
        user: swapsTableV2.user,
        block: swapsTableV2.block,
        tickAt: swapsTableV2.tickAt,
      })
      .from(swapsTableV2)
      .where(chainId ? eq(swapsTableV2.chainId, chainId) : undefined);
  },

  loadLastSwap: (chainId?: number) =>
    db.query.swapsTableV2.findFirst({
      where: and(chainId ? eq(swapsTableV2.chainId, chainId) : undefined),
      orderBy: desc(swapsTableV2.tickAt),
    }),
  loadSwaps: (days = 1, chainId?: number) =>
    db.query.swapsTableV2.findMany({
      with: {
        base: true,
        quote: true,
      },
      where: and(
        chainId ? eq(swapsTableV2.chainId, chainId) : undefined,
        gte(swapsTableV2.tickAt, dayjs().subtract(days, 'days').toDate()),
      ),
    }),
};
