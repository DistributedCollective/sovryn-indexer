import Joi from 'joi';

import { LegacyChainConfig, NetworkConfig, NetworkFeature, SdexChainConfig } from './types';

export function validateConfig(name: string, config: NetworkConfig) {
  const result = Joi.object({
    chainId: Joi.number().required(),
    rpc: Joi.string().required(),
    multicall: Joi.string(),
    staking: Joi.string(),
    stablecoin: Joi.string().required(),
    bitcoin: Joi.string().required(),
    sov: Joi.string().required(),
    features: Joi.array().items(Joi.valid(NetworkFeature.sdex, NetworkFeature.legacy)).required(),
    token: Joi.object({
      symbol: Joi.string().required(),
      name: Joi.string().required(),
      decimals: Joi.number().min(0).required(),
    }).required(),
    sdex: Joi.optional(),
    legacy: Joi.optional(),
  }).validate(config ?? {});

  if (result.error) {
    throw new Error(`Invalid network config for ${name}: ${result.error.message}`);
  }

  if (config.features.includes(NetworkFeature.sdex)) {
    validateSdexConfig(name, config.sdex);
  }

  if (config.features.includes(NetworkFeature.legacy)) {
    validateLegacyConfig(name, config.legacy);
  }
}

function validateSdexConfig(name: string, config: SdexChainConfig) {
  const result = Joi.object({
    subgraph: Joi.string().required(),
    dex: Joi.string().required(),
    query: Joi.string().required(),
    impact: Joi.string().required(),
  }).validate(config ?? {});

  if (result.error) {
    throw new Error(`Invalid Sdex config for ${name}: ${result.error.message}`);
  }
}

function validateLegacyConfig(name: string, config: LegacyChainConfig) {
  const result = Joi.object({
    subgraph: Joi.string().required(),
    native: Joi.string().required(),
    protocol: Joi.string().required(),
    troveManager: Joi.string().required(),
    stabilityPool: Joi.string().required(),
    myntAggregator: Joi.string().default(null),
    zusdToken: Joi.string().default(null),
    babelFishMultisig: Joi.string().default(null),
    babelFishStaking: Joi.string().default(null),
  }).validate(config ?? {});

  if (result.error) {
    throw new Error(`Invalid Legacy config for ${name}: ${result.error.message}`);
  }
}
