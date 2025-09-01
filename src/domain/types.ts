import type { IngestionSourceKey } from '~/database/schema';

export type SyncBatch<T = unknown> = { items: T[]; nextCursor?: string | null };

export interface SourceAdapter<T = unknown> {
  key: IngestionSourceKey;
  chains: number[];
  initialCursor?: string | null;
  fetchNext: (chain: number, cursor?: string | null) => Promise<SyncBatch<T>>;
}
