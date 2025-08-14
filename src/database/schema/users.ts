import { pgTable, timestamp, char } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  address: char('address', { length: 42 }).primaryKey(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
