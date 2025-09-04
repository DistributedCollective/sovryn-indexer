import { pgTable, varchar, serial, timestamp, char, integer } from 'drizzle-orm/pg-core';

import { HighWaterMark } from '~/domain/types';

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

  highWaterMark: varchar('high_water_mark', { length: 32 })
    .$type<HighWaterMark>()
    .notNull()
    .default(HighWaterMark.date),

  backfillCursor: varchar('backfill_cursor', { length: 1024 }),

  liveCursor: varchar('live_cursor', { length: 1024 }),
  liveWatermark: varchar('live_watermark', { length: 256 }),

  lastSyncedAt: timestamp('last_synced_at'),
});

export type IngestionSource = typeof ingestionSourcesTable.$inferSelect;
export type NewIngestionSource = typeof ingestionSourcesTable.$inferInsert;
