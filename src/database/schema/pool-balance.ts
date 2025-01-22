import { pgTable, timestamp, varchar, integer, unique, serial, char, jsonb } from 'drizzle-orm/pg-core';

import { chains } from './chains';
import { poolsTable } from './pools';

export type PoolBalanceExtra = {
  ambientLiq?: string;
  concLiq?: string;
  rewardLiq?: string;
  aggregatedLiquidity?: string;
  aggregatedBaseFlow?: string;
  aggregatedQuoteFlow?: string;
  positionType?: string;
  bidTick?: number;
  askTick?: number;
  aprDuration?: string;
  aprPostLiq?: string;
  aprContributedLiq?: string;
  aprEst?: string;
};

export const poolBalanceTable = pgTable(
  'pool_balance',
  {
    id: serial('id').primaryKey(),
    poolId: integer('pool_id')
      .notNull()
      .references(() => poolsTable.id, { onDelete: 'cascade' }),
    user: char('user', { length: 42 }).notNull(),
    time: varchar('time'),
    baseQty: varchar('baseQty'),
    quoteQty: varchar('quoteQty'),
    chainId: integer('chain_id')
      .notNull()
      .references(() => chains.id, { onDelete: 'cascade' }),
    block: integer('block'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date()),

    extra: jsonb('extra').$type<PoolBalanceExtra>().default({}),
  },
  (t) => ({
    comb: unique('pool_balances_comb_pkey').on(t.user, t.chainId, t.poolId),
  }),
);

export type PoolBalance = typeof poolBalanceTable.$inferSelect;
export type NewPoolBalance = typeof poolBalanceTable.$inferInsert;
