import { ambientUserPoolProvider } from './user_pools/ambient-liquidity-changes';
import { bancorUserPoolProvider } from './user_pools/bancor-liquidity-changes';

export const sources = [ambientUserPoolProvider, bancorUserPoolProvider] as const;
