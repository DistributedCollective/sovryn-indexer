import { JsonRpcProvider } from 'ethers';

import { Multicall, Multicall__factory } from 'artifacts/abis/types';
import { db } from 'database/client';
import { chains } from 'database/schema/chains';
import { getProvider } from 'utils/rpc/rpc';

import { LegacyChain } from './legacy-chain';
import { SdexChain } from './sdex-chain';
import { NativeNetworkToken, NetworkConfig, NetworkFeature } from './types';
import { validateConfig } from './utils';

export class Chain {
  readonly chainId: number;
  readonly chainIdHex: string;
  readonly rpc: JsonRpcProvider;
  readonly supportsMulticall: boolean = false;

  readonly multicall: Multicall;
  readonly stablecoinAddress: string;

  readonly features: NetworkFeature[];
  readonly sdex: SdexChain;
  readonly legacy: LegacyChain;
  readonly token: NativeNetworkToken;

  constructor(public readonly name: string, config: NetworkConfig) {
    validateConfig(name, config);

    this.chainId = config.chainId;
    this.chainIdHex = '0x' + config.chainId.toString(16);
    this.rpc = getProvider(config.rpc);
    this.supportsMulticall = !!config.multicall;
    this.features = config.features;
    this.token = config.token;
    this.stablecoinAddress = config.stablecoin.toLowerCase();

    if (this.supportsMulticall) {
      this.multicall = Multicall__factory.connect(config.multicall, this.rpc);
    }

    if (config.features.includes(NetworkFeature.sdex)) {
      this.sdex = new SdexChain(this, config.sdex);
    }
    if (config.features.includes(NetworkFeature.legacy)) {
      this.legacy = new LegacyChain(this, config.legacy);
    }
  }

  hasFeature(feature: NetworkFeature) {
    return this.features.includes(feature);
  }

  toJSON() {
    return {
      chainId: this.chainId,
      features: this.features,
    };
  }
}
