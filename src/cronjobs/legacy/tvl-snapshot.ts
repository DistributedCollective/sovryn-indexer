import type { LegacyChain } from '~/loader/networks/legacy-chain';
import type { SdexChain } from '~/loader/networks/sdex-chain';
import {
  getAmmPoolTvl,
  getFishTvl,
  getLendingPoolTvl,
  getMyntTvl,
  getProtocolTvl,
  getSdexTvl,
  getStakingTvl,
  getSubprotocolTvl,
  getZeroTvl,
} from '~/loader/tvl/prepare-tvl-cronjob-data';
import { logger } from '~/utils/logger';
import { redis } from '~/utils/redis-client';

const tvlLogger = logger.child({ module: 'tvl-snapshot' });

/**
 * BigInt-safe JSON.stringify replacer – converts BigInt to string,
 * otherwise Redis/JSON will throw.
 */
function bigintReplacer(_key: string, value: unknown) {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

export interface TvlSections {
  tvlAmm?: any;
  tvlLending?: any;
  tvlProtocol?: any;
  tvlSubprotocols?: any;
  tvlZero?: any;
  tvlMynt?: any;
  tvlStaking?: any;
  tvlFish?: any;
  tvlSdex?: any;
}

export interface TvlSnapshot {
  data: {
    updatedAt: string;
    total_usd?: string;
  } & TvlSections;
}

const tvlSnapshotKey = (chainId: number) => `tvl:snapshot:${chainId}`;

export async function loadPrevSnapshot(chainId: number): Promise<TvlSnapshot | null> {
  try {
    const key = tvlSnapshotKey(chainId);
    const raw = await redis.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TvlSnapshot;
    return parsed;
  } catch (err) {
    tvlLogger.error({ chainId, err }, 'Failed to load previous TVL snapshot');
    return null;
  }
}

/**
 * Atomically save a new snapshot for a chain.
 * For most Redis deployments a single SET is effectively atomic.
 */
export async function saveSnapshotAtomic(chainId: number, snapshot: TvlSnapshot): Promise<void> {
  const key = tvlSnapshotKey(chainId);
  const payload = JSON.stringify(snapshot, bigintReplacer);

  try {
    await redis.set(key, payload);
  } catch (err) {
    tvlLogger.error({ chainId, err }, 'Failed to save TVL snapshot');
    throw err;
  }
}

/**
 * Utility: try to compute an aggregate total_usd from known sections.
 * All section objects are expected to have a `totalUsd` string.
 */
function computeTotalUsd(sections: TvlSections): string | undefined {
  const totals: string[] = [];

  for (const key of Object.keys(sections) as (keyof TvlSections)[]) {
    const section = sections[key];
    const v = section?.totalUsd ?? section?.total_usd;
    if (typeof v === 'string') totals.push(v);
  }

  if (!totals.length) return undefined;

  const sum = totals.reduce((acc, v) => {
    const n = Number(v);
    return Number.isFinite(n) ? acc + n : acc;
  }, 0);

  return sum.toString();
}

/**
 * Helper: returns result if fulfilled, otherwise fallback.
 */
async function fromSettledOrFallback<T>(settled: PromiseSettledResult<T>, fallback: T | undefined): Promise<T> {
  if (settled.status === 'fulfilled') return settled.value;
  if (fallback !== undefined) return fallback;
  throw settled.reason ?? new Error('No fallback available');
}

/**
 * Build a coherent "legacy" TVL snapshot (amm, lending, protocol, etc.)
 * using current values or falling back to the last snapshot for any failed section.
 */
export async function buildLegacySnapshot(chain: LegacyChain): Promise<TvlSnapshot> {
  const chainId = chain.context.chainId;
  const prev = (await loadPrevSnapshot(chainId)) ?? { data: {} as any };

  const [ammRes, lendRes, protoRes, subpRes, zeroRes, myntRes, stakingRes, fishRes] = await Promise.allSettled([
    getAmmPoolTvl(chain),
    getLendingPoolTvl(chain),
    getProtocolTvl(chain),
    getSubprotocolTvl(chain),
    getZeroTvl(chain),
    getMyntTvl(chain),
    getStakingTvl(chain.context),
    getFishTvl(chain.context),
  ]);

  const sections: TvlSections = {
    tvlAmm: await fromSettledOrFallback(ammRes, prev.data.tvlAmm),
    tvlLending: await fromSettledOrFallback(lendRes, prev.data.tvlLending),
    tvlProtocol: await fromSettledOrFallback(protoRes, prev.data.tvlProtocol),
    tvlSubprotocols: await fromSettledOrFallback(subpRes, prev.data.tvlSubprotocols),
    tvlZero: await fromSettledOrFallback(zeroRes, prev.data.tvlZero),
    tvlMynt: await fromSettledOrFallback(myntRes, prev.data.tvlMynt),
    tvlStaking: await fromSettledOrFallback(stakingRes, prev.data.tvlStaking),
    tvlFish: await fromSettledOrFallback(fishRes, prev.data.tvlFish),
  };

  const snapshot: TvlSnapshot = {
    data: {
      updatedAt: new Date().toISOString(),
      total_usd: computeTotalUsd(sections),
      ...sections,
    },
  };

  return snapshot;
}

/**
 * Build coherent TVL snapshot for SDEX chain (sdex + staking).
 */
export async function buildSdexSnapshot(chain: SdexChain): Promise<TvlSnapshot> {
  const chainId = chain.context.chainId;
  const prev = (await loadPrevSnapshot(chainId)) ?? { data: {} as any };

  const [sdexRes, stakingRes] = await Promise.allSettled([getSdexTvl(chain), getStakingTvl(chain.context)]);

  const sections: TvlSections = {
    tvlSdex: await fromSettledOrFallback(sdexRes, prev.data.tvlSdex),
    tvlStaking: await fromSettledOrFallback(stakingRes, prev.data.tvlStaking),
  };

  const snapshot: TvlSnapshot = {
    data: {
      updatedAt: new Date().toISOString(),
      total_usd: computeTotalUsd(sections),
      ...sections,
    },
  };

  return snapshot;
}
