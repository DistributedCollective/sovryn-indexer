import { pgTable, timestamp, integer, varchar, char } from 'drizzle-orm/pg-core';

export const chains = pgTable('chains', {
  id: integer('id').primaryKey().notNull(),
  name: varchar('name', { length: 256 }).notNull(),
  stablecoinAddress: char('stablecoin_address', { length: 42 }).notNull(),
  stablecoinIdentifier: char('stablecoin_identifier', { length: 64 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Chain = typeof chains.$inferSelect;
export type NewChain = typeof chains.$inferInsert;
