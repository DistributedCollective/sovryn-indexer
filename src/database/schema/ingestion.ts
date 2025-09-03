import { pgTable, varchar, serial, timestamp, char, jsonb } from 'drizzle-orm/pg-core';

export enum IngestionSourceMode {
  backfill = 'backfill',
  live = 'live',
}

export const ingestionSourcesTable = pgTable('ingestion_sources', {
  id: serial('id').primaryKey(),
  key: char('key', { length: 64 }).notNull().unique(),
  // workaround for drizzle prepared inserts not working with jsonb type
  // https://github.com/drizzle-team/drizzle-orm/issues/1117
  tags: varchar('tags', { length: 1024 }).default('[]'),
  mode: varchar('mode', { length: 32 }).$type<IngestionSourceMode>().notNull().default(IngestionSourceMode.backfill),

  backfillCursor: varchar('backfill_cursor', { length: 1024 }),

  liveCursor: varchar('live_cursor', { length: 1024 }),
  liveSince: timestamp('live_since'),

  lastSyncedAt: timestamp('last_synced_at'),
});

export type IngestionSource = typeof ingestionSourcesTable.$inferSelect;
export type NewIngestionSource = typeof ingestionSourcesTable.$inferInsert;
