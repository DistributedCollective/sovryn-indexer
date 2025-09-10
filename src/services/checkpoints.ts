import { eq, sql } from 'drizzle-orm';

import { db } from '~/database/client';
import { IngestionSource, IngestionSourceMode, ingestionSourcesTable } from '~/database/schema';
import { HighWaterMark } from '~/domain/types';
import { logger } from '~/utils/logger';

const preparedInsert = db
  .insert(ingestionSourcesTable)
  .values({
    key: sql.placeholder('key'),
    tags: sql.placeholder('tags'),
    mode: IngestionSourceMode.backfill,
    highWaterMark: sql.placeholder('highWaterMark'),
  })
  .onConflictDoNothing()
  .returning()
  .prepare('insert_ingestion_source');

const preparedSelect = db.query.ingestionSourcesTable
  .findFirst({
    where: eq(ingestionSourcesTable.key, sql.placeholder('key')),
  })
  .prepare('select_ingestion_source');

const log = logger.child({ service: 'checkpoints' });

const get = async (sourceKey: string) => preparedSelect.execute({ key: sourceKey });

const getOrCreate = async (sourceKey: string, tags: string[], highWaterMark: HighWaterMark = HighWaterMark.date) => {
  const insert = await preparedInsert.execute({
    key: sourceKey,
    tags: JSON.stringify(tags),
    highWaterMark,
  });
  if (insert.length) {
    return insert[0] as IngestionSource;
  }

  return get(sourceKey);
};

const markBackfillProgress = async (cp: IngestionSource, cursor: string | null, highWater?: string) => {
  try {
    // If cursor is null OR we've reached near-now (live edge), flip to live mode.
    const now = new Date();

    const nearNow =
      cp.highWaterMark === HighWaterMark.date && highWater
        ? now.getTime() - new Date(Number(highWater)).getTime() <= 300_000
        : false;

    if (cursor === null || nearNow) {
      await db
        .update(ingestionSourcesTable)
        .set({
          mode: IngestionSourceMode.live,
          backfillCursor: null,
          liveWatermark: highWater,
          lastSyncedAt: now,
        })
        .where(eq(ingestionSourcesTable.key, cp.key))
        .execute();
    } else {
      await db
        .update(ingestionSourcesTable)
        .set({ backfillCursor: cursor, lastSyncedAt: now })
        .where(eq(ingestionSourcesTable.key, cp.key))
        .execute();
    }
  } catch (e) {
    log.error({ err: e, key: cp.key, cursor, highWater }, 'error: markBackfillProgress');
    throw e;
  }
};

const markIncrementalProgress = async (key: string, cursor?: string | null, highWater?: string) => {
  try {
    const now = new Date();
    if (highWater !== undefined && highWater !== null) {
      await db
        .update(ingestionSourcesTable)
        .set({
          liveCursor: cursor ?? null,
          lastSyncedAt: now,
          liveWatermark: sql`GREATEST(${ingestionSourcesTable.liveWatermark}, ${highWater})`,
        })
        .where(eq(ingestionSourcesTable.key, key))
        .execute();
    } else {
      await db
        .update(ingestionSourcesTable)
        .set({ liveCursor: cursor ?? null, lastSyncedAt: now })
        .where(eq(ingestionSourcesTable.key, key))
        .execute();
    }
  } catch (err) {
    log.error({ err, key, cursor }, 'error: markIncrementalProgress');
  }
};

export const checkpoints = {
  getOrCreate,
  get,
  markBackfillProgress,
  markIncrementalProgress,
};
