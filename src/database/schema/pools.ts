import { relations } from 'drizzle-orm';
import { pgTable, timestamp, varchar, integer, unique, serial, boolean, jsonb, char } from 'drizzle-orm/pg-core';

import { chains } from './chains';
import { tokens } from './tokens';

export enum PoolType {
  ambient = 'ambient',
  bancor = 'bancor',
}

export type PoolExtra = {
  // for ambient pools
  poolIdx?: number;
  lpToken?: string;
  // for bancor pools
  type?: number;
  version?: number | null;
  smartToken?: string;
};

export const poolsTable = pgTable(
  'pools',
  {
    id: serial('id').primaryKey(),
    chainId: integer('chain_id')
      .notNull()
      .references(() => chains.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 64 }).$type<PoolType>().notNull(),
    legacyIdentifier: varchar('identifier', { length: 256 }).notNull(),
    // todo: change to primary key and make nonNull after migration
    identifier: char('new_identifier', { length: 64 }).unique(),
    baseId: integer('base_id')
      .notNull()
      .references(() => tokens.id, { onDelete: 'cascade' }),
    quoteId: integer('quote_id')
      .notNull()
      .references(() => tokens.id, { onDelete: 'cascade' }),
    baseIdentifier: char('base_identifier', { length: 64 }),
    quoteIdentifier: char('quote_identifier', { length: 64 }),
    featured: boolean('highlighted').default(false), // if pool needs to be on top of the list
    price: varchar('price', { length: 256 }).default('0'), // last price of base in quote
    fee: varchar('fee', { length: 256 }).default('0'), // fee protocol charges for swaps in % (0-100)
    apr: varchar('apr', { length: 256 }).default('0'), // expected APR for providing liquidity in % (0-100)
    baseLiquidity: varchar('base_liquidity', { length: 256 }).default('0'),
    quoteLiquidity: varchar('quote_liquidity', { length: 256 }).default('0'),
    baseVolume: varchar('base_volume', { length: 256 }).default('0'),
    quoteVolume: varchar('quote_volume', { length: 256 }).default('0'),
    dailyBaseVolume: varchar('daily_volume', { length: 256 }).default('0'),
    dailyQuoteVolume: varchar('daily_quote_volume', { length: 256 }).default('0'),
    extra: jsonb('extra').$type<PoolExtra>().default({}), // extra data for pool
    // to track when pool had data updated using cronjobs (liquidity, volume, etc)
    processedAt: timestamp('processed_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date()),
    // to track as not processed if pool was added by dependency and may have unfilled data.
    processed: boolean('processed').default(true),
  },
  (t) => ({
    comb: unique('pools_idx_comb').on(t.chainId, t.type, t.legacyIdentifier),
    search_comb: unique('pools_search_comb').on(t.chainId, t.legacyIdentifier),
  }),
);

export const poolsTableRelations = relations(poolsTable, ({ one }) => ({
  chain: one(chains, { fields: [poolsTable.chainId], references: [chains.id] }),
  base: one(tokens, { fields: [poolsTable.baseId], references: [tokens.id] }),
  quote: one(tokens, { fields: [poolsTable.quoteId], references: [tokens.id] }),
}));

export type Pool = typeof poolsTable.$inferSelect;
export type NewPool = typeof poolsTable.$inferInsert;

export const poolPositionsTable = pgTable('pool_positions', {
  id: serial('id'),
  identifier: char('identifier', { length: 64 }).notNull().primaryKey(),
  chainId: integer('chain_id')
    .notNull()
    .references(() => chains.id, { onDelete: 'cascade' }),
  poolId: char('pool_id', { length: 64 }), // todo: add reference to pools table
  user: char('user', { length: 42 }).notNull(), // user address
  extra: jsonb('extra').$type<PoolExtra>().default({}),
  createdAt: timestamp('created_at').defaultNow(),
});

export type PoolPosition = typeof poolPositionsTable.$inferSelect;
export type NewPoolPosition = typeof poolPositionsTable.$inferInsert;

export type PoolLiquidityChangeExtra = {
  //
};

export const poolLiquidityChangesTable = pgTable('pool_liquidity_changes', {
  id: serial('id'),
  identifier: char('identifier', { length: 64 }).notNull().primaryKey(),
  chainId: integer('chain_id')
    .notNull()
    .references(() => chains.id, { onDelete: 'cascade' }),
  poolId: char('pool_id', { length: 64 }), // todo: add reference to pools table
  positionId: char('position_id', { length: 64 }).references(() => poolPositionsTable.identifier, {
    onDelete: 'cascade',
  }),
  user: char('user', { length: 42 }).notNull(), // user address
  extra: jsonb('extra').$type<PoolLiquidityChangeExtra>().default({}),
  provider: varchar('provider', { length: 256 }).notNull(),
  type: varchar('type', { length: 256 }).notNull(),
  tokenId: char('token_id', { length: 64 }), // todo: add reference to tokens table once identifier is primary key
  tokenAmount: varchar('token_amount', { length: 256 }).notNull().default('0'),
  transactionHash: varchar('transaction_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export type PoolLiquidityChange = typeof poolLiquidityChangesTable.$inferSelect;
export type NewPoolLiquidityChange = typeof poolLiquidityChangesTable.$inferInsert;
