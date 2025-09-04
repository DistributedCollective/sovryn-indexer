import { tokenFetcherSource } from './tokens/token-fetcher';
import { ambientPoolLiquidityChangesSource } from './pools/liquidity-changes/ambient.liquidity-changes';
import { bancorPoolLiquidityChangesSource } from './pools/liquidity-changes/bancor.liquidity-changes';
import { ambientPoolFetcherSource } from './pools/ambient.pool-fetcher';

export const sources = [
  // fetch tokens
  tokenFetcherSource,
  // fetch pools
  ambientPoolFetcherSource,
  // fetch pool liquidity changes
  // ambientPoolLiquiditySource,
  // bancorPoolLiquiditySource,
] as const;
