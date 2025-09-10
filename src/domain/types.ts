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

  // highWaterMark determines the strategy for watermarking (date timestamps or block numbers (blocks can be also used as alphanumeric strings))
  highWaterMark?: HighWaterMark;
  highWaterOverlapWindow?: number;

  // return false if job should be skipped, defaults to true
  enabled?: (ctx: Context<C>) => Promise<boolean>;
  // return number in seconds to throttle delay jobs after last update, disabled by default
  throttle?: (ctx: Context<C>) => Promise<number>;

  fetchBackfill: (cursor: string | null, ctx: Context<C>) => Promise<BackfillResult<T>>;
  fetchIncremental?: (watermark: string, cursor: string | null, ctx: Context<C>) => Promise<SyncBatch<T>>;

  ingest: (items: T[], ctx: Context<C>) => Promise<IngestResult>;

  /**
   * Called when new live data is ingested
   * should trigger additional tasks like summarization or computation
   * if isLastBatch is false - additional data may still be incoming in another batch / page of the source
   */
  onLiveIngested?: (items: T[], ctx: Context<C>, isLastBatch?: boolean) => Promise<void>;
  /**
   * Called when backfill data is ingested
   * should trigger additional tasks like summarization or computation
   * isLastBatch indicates that this is the last batch before reaching live edge
   */
  onBackfillIngested?: (items: T[], ctx: Context<C>, isLastBatch?: boolean) => Promise<void>;
}
