export type NetworkConfigFile = Record<string, NetworkConfig>;

export enum NetworkFeature {
  sdex = 'sdex',
  legacy = 'legacy',
  liquidity = 'liquidity',
}

export type NativeNetworkToken = {
  symbol: string;
  name: string;
  decimals: number;
};

export type NetworkConfig = {
  chainId: number;
  rpc: string;
  multicall: string;
  staking: string;
  stablecoin: string;
  bitcoin: string;
  sov: string;
  features: NetworkFeature[];
  token: NativeNetworkToken;
  sdex?: SdexChainConfig;
  liquidity?: LiquidityChainConfig;
  legacy?: LegacyChainConfig;
};

export type SdexChainConfig = {
  block: number;
  subgraph: string;
  graphcache: string;
  dex: string;
  query: string;
  impact: string;
};

export type LiquidityChainConfig = {
  subgraph: string;
};

export type LegacyChainConfig = {
  block: number;
  subgraph: string;
  native: string;
  protocol: string;
  troveManager: string;
  stabilityPool: string;
  myntAggregator?: string;
  zusdToken?: string;
  babelFishMultisig?: string;
  babelFishStaking?: string;
  // todo: add contract addresses as needed such as staking, pool registries, etc.
};
