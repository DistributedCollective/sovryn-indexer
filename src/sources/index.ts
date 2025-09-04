import { tokenFetcherSource } from './tokens/token-fetcher';
import { ambientPoolLiquidityChangesSource } from './pools/liquidity-changes/ambient.liquidity-changes';
import { bancorPoolLiquidityChangesSource } from './pools/liquidity-changes/bancor.liquidity-changes';
import { ambientPoolFetcherSource } from './pools/ambient.pool-fetcher';
import { bancorPoolFetcherSource } from './pools/bancor.pool-fetcher';

export const sources = [
  // fetch tokens
  tokenFetcherSource,
  // fetch pools
  ambientPoolFetcherSource,
  bancorPoolFetcherSource,
  // fetch pool liquidity changes
  ambientPoolLiquidityChangesSource,
  bancorPoolLiquidityChangesSource,
] as const;
