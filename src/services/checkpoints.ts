import { eq, sql } from 'drizzle-orm';

import { db } from '~/database/client';
import { IngestionSource, IngestionSourceMode, ingestionSourcesTable } from '~/database/schema';
import { logger } from '~/utils/logger';

const preparedInsert = db
  .insert(ingestionSourcesTable)
  .values({ key: sql.placeholder('key'), tags: sql.placeholder('tags'), mode: IngestionSourceMode.backfill })
  .onConflictDoNothing()
  .returning()
  .prepare('insert_ingestion_source');

const preparedSelect = db.query.ingestionSourcesTable
  .findFirst({
    where: eq(ingestionSourcesTable.key, sql.placeholder('key')),
  })
  .prepare('select_ingestion_source');

const log = logger.child({ service: 'checkpoints' });

const getOrCreate = async (sourceKey: string, tags: string[]) => {
  const insert = await preparedInsert.execute({ key: sourceKey, tags: JSON.stringify(tags) });
  if (insert.length) {
    return insert[0] as IngestionSource;
  }

  return preparedSelect.execute({ key: sourceKey });
};

const markBackfillProgress = async (key: string, cursor: string | null, lastTimestamp?: Date) => {
  try {
    // If cursor is null OR we've reached near-now (live edge), flip to live mode.
    const now = new Date();
    const nearNow = lastTimestamp ? (now.getTime() - lastTimestamp.getTime()) / 1000 <= 3000 : false;
    if (cursor === null || nearNow) {
      await db
        .update(ingestionSourcesTable)
        .set({
          mode: IngestionSourceMode.live,
          backfillCursor: null,
          liveSince: lastTimestamp === null ? now : lastTimestamp,
          lastSyncedAt: now,
        })
        .where(eq(ingestionSourcesTable.key, key))
        .execute();
    } else {
      await db
        .update(ingestionSourcesTable)
        .set({ backfillCursor: cursor, lastSyncedAt: now })
        .where(eq(ingestionSourcesTable.key, key))
        .execute();
    }
  } catch (e) {
    log.error({ err: e, key, cursor, lastTimestamp }, 'error: markBackfillProgress');
    throw e;
  }
};

const markIncrementalProgress = async (key: string, cursor?: string | null) => {
  try {
    const now = new Date();
    await db
      .update(ingestionSourcesTable)
      .set({ liveCursor: cursor ?? null, lastSyncedAt: now })
      .where(eq(ingestionSourcesTable.key, key))
      .execute();
  } catch (err) {
    log.error({ err, key, cursor }, 'error: markIncrementalProgress');
  }
};

export const checkpoints = {
  getOrCreate,
  markBackfillProgress,
  markIncrementalProgress,
};
