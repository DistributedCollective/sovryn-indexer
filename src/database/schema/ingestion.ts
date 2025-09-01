import { pgTable, varchar, serial, timestamp, boolean, integer, unique } from 'drizzle-orm/pg-core';
import { chains } from './chains';

export enum IngestionSourceKey {
  mock = 'mock',
}

export const ingestionSourcesTable = pgTable(
  'ingestion_sources',
  {
    id: serial('id').primaryKey(),
    chainId: integer('chain_id')
      .notNull()
      .references(() => chains.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 256 }).$type<IngestionSourceKey>().notNull(),
    cursor: varchar('cursor', { length: 1024 }),
    lastSyncedAt: timestamp('last_synced_at'),
    isBackfilling: boolean('is_backfilling').notNull().default(true),
  },
  (t) => ({
    comb: unique('ingestion_sources_idx_comb').on(t.chainId, t.key),
  }),
);

export type IngestionSource = typeof ingestionSourcesTable.$inferSelect;
export type NewIngestionSource = typeof ingestionSourcesTable.$inferInsert;
