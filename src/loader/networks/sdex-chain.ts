import { DocumentNode } from 'graphql';
import gql from 'graphql-tag';

import { SdexQuery, SdexQuery__factory, SdexSwapDex, SdexSwapDex__factory } from 'artifacts/abis/types';
import { queryFromSubgraph } from 'loader/subgraph';
import { getPositions, getUserPositions } from 'loader/userPositionsLoader';
import { LiquidityChanges, LiquidityChangesResponse, SwapsResponse } from 'typings/subgraph/liquidity';
import { loadGqlFromArtifacts } from 'utils/subgraph';

import type { Chain } from './chain-config';
import type { SdexChainConfig } from './types';

const gqlPools = loadGqlFromArtifacts('graphQueries/sdex/pools.graphql');
const gqlLiquidityChanges = loadGqlFromArtifacts('graphQueries/sdex/liqchanges.graphql');
const gqlUserLiquidityChanges = loadGqlFromArtifacts('graphQueries/sdex/user-liqchanges.graphql');
const gqlUsersLiquidityChanges = loadGqlFromArtifacts('graphQueries/sdex/users-liqchanges.graphql');
const gqlSwaps = loadGqlFromArtifacts('graphQueries/sdex/swaps.graphql');

export class SdexChain {
  readonly dex: SdexSwapDex;
  readonly query: SdexQuery;
  readonly graphCacheUrl: string;

  readonly startBlock: number;

  constructor(readonly context: Chain, readonly config: SdexChainConfig) {
    this.startBlock = config.block;
    this.dex = SdexSwapDex__factory.connect(config.dex, this.context.rpc);
    this.query = SdexQuery__factory.connect(config.query, this.context.rpc);

    this.graphCacheUrl = config.graphcache;
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

  public async queryUserLquidityChanges(user: string) {
    return this.queryFromSubgraph<LiquidityChangesResponse>(gqlUserLiquidityChanges, { user });
  }

  public async queryLquidityChanges(minTime: number) {
    const { liquidityChanges } = await this.queryFromSubgraph<LiquidityChangesResponse>(gqlLiquidityChanges, {
      minTime,
    });

    return liquidityChanges;
  }

  public async queryPositions(users: string[]) {
    const { liquidityChanges } = await this.queryFromSubgraph<LiquidityChangesResponse>(gqlUsersLiquidityChanges, {
      users,
    });

    const groupedLiquidityChanges: { [user: string]: LiquidityChanges[] } = {};

    liquidityChanges.forEach((liquidityChange) => {
      if (!groupedLiquidityChanges[liquidityChange.user]) {
        groupedLiquidityChanges[liquidityChange.user] = [liquidityChange];
      } else {
        groupedLiquidityChanges[liquidityChange.user].push(liquidityChange);
      }
    });

    const positions = await Promise.all(
      Object.keys(groupedLiquidityChanges).map((user) =>
        getPositions(this.query, this.context.rpc, groupedLiquidityChanges[user], this.context),
      ),
    );

    return positions.flat();
  }

  public async querySwaps(minTime: number, maxTime: number) {
    return this.queryFromSubgraph<SwapsResponse>(gqlSwaps, { minTime, maxTime });
  }

  public async getUpdatedLiquidity(user: string, base: string, quote: string, poolIdx: number) {
    const { liquidityChanges } = await this.queryUserLquidityChanges(user);
    const positions = await getUserPositions(this.query, this.context.rpc, liquidityChanges, this.context);

    return positions.filter(
      (position) =>
        position.base.toLowerCase() === base.toLowerCase() &&
        position.quote.toLowerCase() === quote.toLowerCase() &&
        position.poolIdx === poolIdx.toString(),
    );
  }
  public async getUserPositions(user: string) {
    const { liquidityChanges } = await this.queryUserLquidityChanges(user);
    return getUserPositions(this.query, this.context.rpc, liquidityChanges, this.context);
  }

  public async queryBlockNumber() {
    return this.queryFromSubgraph<{ _meta: { block: { number: number } } }>(
      gql`
        {
          _meta {
            block {
              number
            }
          }
        }
      `,
    ).then((data) => data._meta.block.number);
  }

  toString() {
    return this.context.chainId;
  }
}
