import { ethers, ZeroAddress } from 'ethers';
import { DocumentNode } from 'graphql';

import QueryContractABI from 'artifacts/abis/SdexQuery.json';
import { SdexQuery, SdexQuery__factory } from 'artifacts/abis/types';
import { queryFromSubgraph } from 'loader/subgraph';
import { getUserPositions } from 'loader/userPositionsLoader';
import { LiquidityChangesResponse } from 'typings/subgraph/liquidity';
import { loadGqlFromArtifacts } from 'utils/subgraph';

import type { Chain } from './chain-config';
import type { SdexChainConfig } from './types';

const gqlPools = loadGqlFromArtifacts('graphQueries/sdex/pools.graphql');
const gqlLiquidityChanges = loadGqlFromArtifacts('graphQueries/sdex/liqchanges.graphql');

export class SdexChain {
  readonly query: SdexQuery;
  readonly queryContract: ethers.Contract;

  constructor(readonly context: Chain, readonly config: SdexChainConfig) {
    this.query = SdexQuery__factory.connect(config.query, this.context.rpc);
    this.queryContract = new ethers.Contract(config.query, QueryContractABI, this.context.rpc);
  }

  public queryFromSubgraph<T>(query: DocumentNode, variables: Record<string, unknown> = {}) {
    return queryFromSubgraph<T>(this.config.subgraph, query, variables);
  }

  public async queryPools(limit: number) {
    return this.queryFromSubgraph<{
      pools: {
        base: string;
        quote: string;
        poolIdx: number;
      }[];
    }>(gqlPools, { limit });
  }

  public async queryUserPositions(user: string) {
    return this.queryFromSubgraph<LiquidityChangesResponse>(gqlLiquidityChanges, { user });
  }

  public async getUpdatedLiquidity(user: string, base: string, quote: string, poolIdx: number) {
    const { liquidityChanges } = await this.queryUserPositions(user);
    return getUserPositions(this.query, this.context.rpc, user, base, quote, poolIdx, liquidityChanges);
  }

  toString() {
    return this.context.chainId;
  }
}
