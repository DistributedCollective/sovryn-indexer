import { logger } from '~/utils/logger';
import type { SourceAdapter, SyncBatch } from '../domain/types';
import { IngestionSourceKey } from '~/database/schema';

let page = 0;
const pageSize = 250;

export type MockItem = {
  source: string;
  externalId: string;
  occurredAt: string;
  userExternalId: string;
  type: 'deposit' | 'withdrawal';
  currency: string;
  amountMinor: bigint;
  metadata: Record<string, unknown>;
};

export const mockProvider: SourceAdapter<MockItem> = {
  key: IngestionSourceKey.mock,
  chains: [30, 31],
  initialCursor: '0',
  async fetchNext(chain, cursor) {
    const p = cursor ? parseInt(cursor, 10) : page;

    logger.info({ cursor, p }, 'MockProvider fetching next page');

    if (p > 20) return { items: [], nextCursor: null };

    const items = Array.from({ length: pageSize }).map((_, i) => {
      const idx = p * pageSize + i;
      const isDeposit = idx % 3 !== 0;
      return {
        source: 'mock',
        externalId: `tx_${idx}`,
        occurredAt: new Date(Date.now() - (20 - p) * 3600_000).toISOString(),
        userExternalId: `ext_${idx % 50}`,
        type: isDeposit ? 'deposit' : 'withdrawal',
        currency: 'EUR',
        amountMinor: BigInt(isDeposit ? 1000 : -500),
        metadata: { idx },
      } as const;
    });

    const nextCursor = p + 1 <= 20 ? String(p + 1) : null;
    return { items, nextCursor } satisfies SyncBatch<MockItem>;
  },
};
