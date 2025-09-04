import { IngestionSource } from '~/database/schema';
import { Chain } from '~/loader/networks/chain-config';

export type Context<C = unknown> = { chain: Chain; checkpoint: IngestionSource } & C;

export type SyncBatch<T = unknown> = { items: T[]; nextCursor?: string | null };

export type BackfillResult<T = unknown> = SyncBatch<T> & { atLiveEdge?: boolean };
export type IngestResult = {
  // if highWater is date (highWaterMark = date), it must be returned as javascript timestamp (date.getTime().toString())
  highWater: string | null;
};

export enum HighWaterMark {
  date = 'date',
  block = 'block',
}

export interface SourceAdapter<T = unknown, C = unknown> {
  name: string;
  chains: number[];

  highWaterMark?: HighWaterMark;
  highWaterOverlapWindow?: number;

  enabled?: (ctx: Context<C>) => Promise<boolean>;

  fetchBackfill: (cursor: string | null, ctx: Context<C>) => Promise<BackfillResult<T>>;
  fetchIncremental?: (watermark: string, cursor: string | null, ctx: Context<C>) => Promise<SyncBatch<T>>;

  ingest: (items: T[], ctx: Context<C>) => Promise<IngestResult>;

  /** Called when new live data is ingested
   * should trigger additional tasks like summarization or computation
   */
  onLiveIngested?: (items: T[], ctx: Context<C>) => Promise<void>;
  onBackfillIngested?: (items: T[], ctx: Context<C>) => Promise<void>;
}
