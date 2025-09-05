import { relations } from 'drizzle-orm';
import { pgTable, timestamp, varchar, integer, unique, serial, char } from 'drizzle-orm/pg-core';

import { tokens } from './tokens';

// tables only story token prices in USD and are updated by minute, hourly, and daily intervals
// new row are only inserted if price of previous date is different
// prices are stored as string to avoid precision loss
// low and high are the lowest and highest price of the interval
// open and close values are not stored as they can be calculated from the first and last row of the interval

// by minute
export const usdPricesTable = pgTable(
  'prices_usd',
  {
    id: serial('id').primaryKey(),
    tokenId: integer('token_id')
      .notNull()
      .references(() => tokens.id, { onDelete: 'cascade' }),
    tokenIdentifier: char('token_identifier', { length: 64 }),
    value: varchar('value', { length: 256 }).notNull().default('0'),
    low: varchar('low', { length: 256 }).notNull().default('0'),
    high: varchar('high', { length: 256 }).notNull().default('0'),
    tickAt: timestamp('tick_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    prices_usd_comb: unique('prices_usd_comb').on(t.tokenId, t.tickAt),
  }),
);

export const usdPricesTableRelations = relations(usdPricesTable, ({ one }) => ({
  token: one(tokens, { fields: [usdPricesTable.tokenId], references: [tokens.id] }),
}));

export type UsdPrice = typeof usdPricesTable.$inferSelect;
export type NewUsdPrice = typeof usdPricesTable.$inferInsert;

// by hour
export const usdHourlyPricesTable = pgTable(
  'prices_usd_hourly',
  {
    id: serial('id').primaryKey(),
    tokenId: integer('token_id')
      .notNull()
      .references(() => tokens.id, { onDelete: 'cascade' }),
    tokenIdentifier: char('identifier', { length: 64 }),
    value: varchar('value', { length: 256 }).notNull().default('0'),
    low: varchar('low', { length: 256 }).notNull().default('0'),
    high: varchar('high', { length: 256 }).notNull().default('0'),
    tickAt: timestamp('tick_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    prices_usd_hourly_comb: unique('prices_usd_hourly_comb').on(t.tokenId, t.tickAt),
  }),
);

export const usdHourlyPricesTableRelations = relations(usdHourlyPricesTable, ({ one }) => ({
  token: one(tokens, { fields: [usdHourlyPricesTable.tokenId], references: [tokens.id] }),
}));

export type UsdHourlyPrice = typeof usdHourlyPricesTable.$inferSelect;
export type NewHourlyUsdPrice = typeof usdHourlyPricesTable.$inferInsert;

// by day
export const usdDailyPricesTable = pgTable(
  'prices_usd_daily',
  {
    id: serial('id').primaryKey(),
    tokenId: integer('token_id')
      .notNull()
      .references(() => tokens.id, { onDelete: 'cascade' }),
    tokenIdentifier: char('identifier', { length: 64 }),
    value: varchar('value', { length: 256 }).notNull().default('0'),
    low: varchar('low', { length: 256 }).notNull().default('0'),
    high: varchar('high', { length: 256 }).notNull().default('0'),
    tickAt: timestamp('tick_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    prices_usd_daily_comb: unique('prices_usd_daily_comb').on(t.tokenId, t.tickAt),
  }),
);

export const usdDailyPricesTableRelations = relations(usdDailyPricesTable, ({ one }) => ({
  token: one(tokens, { fields: [usdDailyPricesTable.tokenId], references: [tokens.id] }),
}));

export type UsdDailyPrice = typeof usdDailyPricesTable.$inferSelect;
export type NewUsdDailyPrice = typeof usdDailyPricesTable.$inferInsert;

export type UsdPricesTables = typeof usdPricesTable | typeof usdHourlyPricesTable | typeof usdDailyPricesTable;
