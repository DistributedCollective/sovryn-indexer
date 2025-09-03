import { Chain } from '~/loader/networks/chain-config';

export type Context<C = unknown> = { chain: Chain } & C;

export type SyncBatch<T = unknown> = { items: T[]; nextCursor?: string | null };

export type BackfillResult<T = unknown> = SyncBatch<T> & { atLiveEdge?: boolean };
export type IngestResult = {
  /* todo: should be watermark? */
  lastTimestamp: Date;
};

export interface SourceAdapter<T = unknown, C = unknown> {
  name: string;
  chains: number[];

  fetchBackfill: (cursor: string | null, ctx: Context<C>) => Promise<BackfillResult<T>>;
  fetchIncremental?: (watermark: string, cursor: string | null, ctx: Context<C>) => Promise<SyncBatch<T>>;

  ingest: (items: T[], ctx: Context<C>) => Promise<IngestResult>;

  /** Called when new live data is ingested
   * should trigger additional tasks like summarization or computation
   */
  onLiveIngested?: (items: T[], ctx: Context<C>) => Promise<void>;
  onBackfillIngested?: (items: T[], ctx: Context<C>) => Promise<void>;
}
