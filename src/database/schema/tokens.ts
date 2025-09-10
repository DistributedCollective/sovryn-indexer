import { relations } from 'drizzle-orm';
import { pgTable, timestamp, varchar, integer, unique, serial, char, boolean, text } from 'drizzle-orm/pg-core';

import { chains } from './chains';
import { usdDailyPricesTable, usdHourlyPricesTable, usdPricesTable } from './usd-prices';

export const tokens = pgTable(
  'tokens',
  {
    id: serial('id').primaryKey(),
    // todo: change to primary key and make nonNull after migration
    identifier: char('identifier', { length: 64 }).unique(),
    symbol: varchar('symbol', { length: 24 }),
    name: varchar('name', { length: 256 }),
    decimals: integer('decimals').default(18),
    chainId: integer('chain_id')
      .notNull()
      .references(() => chains.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    address: char('address', { length: 42 }),
    ignored: boolean('ignored').default(false),
    swapableSince: timestamp('swapable_since'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date()),
    logoUrl: text('logo_url'),
    processed: boolean('processed').default(true),
  },
  (t) => ({
    chain_address_pkey: unique('chain_address_pkey').on(t.chainId, t.address),
  }),
);

export type Token = typeof tokens.$inferSelect;
export type NewToken = typeof tokens.$inferInsert;

export const tokensRelations = relations(tokens, ({ one, many }) => ({
  chain: one(chains, { fields: [tokens.chainId], references: [chains.id] }),
  usdDailyPrices: many(usdDailyPricesTable),
  usdHourlyPrices: many(usdHourlyPricesTable),
  usdPrices: many(usdPricesTable),
}));
