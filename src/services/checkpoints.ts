export async function getOrCreateCheckpoint(sourceKey: string) {
  // const existing = await db.query.ingestionSource.findFirst({ where: eq(ingestionSource.key, sourceKey) });
  // if (existing) return existing;
  // await db.insert(ingestionSource).values({ key: sourceKey, isBackfilling: true });
  // return await db.query.ingestionSource.findFirst({ where: eq(ingestionSource.key, sourceKey) });
}

export async function saveCursor(sourceKey: string, cursor: string | null, lastSyncedAt?: Date) {
  // await db
  //   .update(ingestionSource)
  //   .set({ cursor: cursor ?? null, lastSyncedAt: lastSyncedAt ?? new Date(), isBackfilling: cursor !== null })
  //   .where(eq(ingestionSource.key, sourceKey));
}
