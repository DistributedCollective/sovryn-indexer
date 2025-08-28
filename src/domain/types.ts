export type SyncBatch<T = unknown> = { items: T[]; nextCursor?: string | null };

export interface SourceAdapter<T = unknown> {
  key: string;
  initialCursor?: string | null;
  fetchNext: (cursor?: string | null) => Promise<SyncBatch<T>>;
}
