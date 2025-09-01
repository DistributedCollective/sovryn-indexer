import { and, eq, sql } from 'drizzle-orm';
import { db } from '~/database/client';
import { IngestionSource, IngestionSourceKey, ingestionSourcesTable } from '~/database/schema';
import { logger } from '~/utils/logger';

const getOrCreate = async (chainId: number, sourceKey: IngestionSourceKey) => {
  const sq = db.insert(ingestionSourcesTable).values({ key: sourceKey, chainId }).onConflictDoNothing().getSQL();

  const sl = db
    .select()
    .from(ingestionSourcesTable)
    .where(and(eq(ingestionSourcesTable.chainId, chainId), eq(ingestionSourcesTable.key, sourceKey)))
    .limit(1)
    .getSQL();

  const result = await db.execute<IngestionSource>(sql`
    WITH ins AS (${sq})
    SELECT * FROM ins
    UNION ALL
    ${sl};
`);

  logger.info({ checkpoint: true, result }, `getOrCreate`);

  // For node-postgres driver: result.rows
  // For postgres-js driver: result (already rows)
  const row = ('rows' in result ? result.rows : result)[0];
  if (!row) throw new Error('Unexpected: no row returned');
  return row;
};

const saveCursor = (chainId: number, sourceKey: IngestionSourceKey, cursor: string | null, lastSyncedAt?: Date) =>
  db
    .update(ingestionSourcesTable)
    .set({ cursor: cursor ?? null, lastSyncedAt: lastSyncedAt ?? new Date(), isBackfilling: cursor !== null })
    .where(and(eq(ingestionSourcesTable.chainId, chainId), eq(ingestionSourcesTable.key, sourceKey)));

export const checkpoints = {
  getOrCreate,
  saveCursor,
};
