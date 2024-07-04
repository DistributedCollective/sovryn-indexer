import { ethers, ZeroAddress } from 'ethers';
import { bignumber } from 'mathjs';

import { SdexQuery } from 'artifacts/abis/types';
import { LiquidityChangesResponse, PositionType } from 'typings/subgraph/liquidity';
import {
  aggregatePositions,
  filterPositions,
  parseAmbientTokensResult,
  parseRangeTokensResult,
  parseRewardResult,
} from 'utils/aggregationUtils';
import { calculateAPR } from 'utils/aprCalculation';

import { Chain } from './networks/chain-config';

export async function getLPTokenBalance(rpc: ethers.JsonRpcProvider, user: string, token: string): Promise<string> {
  if (token === ZeroAddress) {
    const balance = await rpc.getBalance(user);
    return balance.toString();
  } else {
    const tokenContract = new ethers.Contract(token, ['function balanceOf(address) view returns (uint256)'], rpc);
    const balance = await tokenContract.balanceOf(user);
    return balance.toString();
  }
}

export async function getUserPositions(
  queryContract: SdexQuery,
  rpc: ethers.JsonRpcProvider,
  user: string,
  base: string,
  quote: string,
  poolIdx: number,
  liquidityChanges: LiquidityChangesResponse['liquidityChanges'],
  chain: Chain,
) {
  const concentratedPositions = filterPositions(liquidityChanges, poolIdx, base, quote, PositionType.concentrated);
  const ambientPositions = filterPositions(liquidityChanges, poolIdx, base, quote, PositionType.ambient);

  if (concentratedPositions.length === 0 && ambientPositions.length === 0) {
    return null;
  }

  const ambientMulticallData = ambientPositions.flatMap(() => [
    {
      target: queryContract.getAddress(),
      callData: queryContract.interface.encodeFunctionData('queryAmbientTokens', [user, base, quote, poolIdx]),
    },
    {
      target: queryContract.getAddress(),
      callData: queryContract.interface.encodeFunctionData('queryPoolLpTokenAddress', [base, quote, poolIdx]),
    },
  ]);

  const ambientMulticallResults = await chain.multicall.tryAggregate.staticCall(true, ambientMulticallData);

  const ambientPositionResults = await Promise.all(
    ambientPositions.map(async (userLiquidity, index) => {
      const ambientTokensResult = ambientMulticallResults[index * 2];
      const lpTokenAddressResult = ambientMulticallResults[index * 2 + 1];

      if (ambientTokensResult.success && lpTokenAddressResult.success) {
        const ambientTokens = parseAmbientTokensResult(
          queryContract.interface.decodeFunctionResult('queryAmbientTokens', ambientTokensResult.returnData),
        );
        const lpTokenAddress = queryContract.interface.decodeFunctionResult(
          'queryPoolLpTokenAddress',
          lpTokenAddressResult.returnData,
        )[0];

        const lpTokenBalance = await getLPTokenBalance(rpc, user, lpTokenAddress);

        const ambientLiq = bignumber(ambientTokens.liq).plus(bignumber(lpTokenBalance)).toFixed(0);
        const apr = calculateAPR(
          false, // isConcentrated
          '0', // rewardLiq
          '0', // concLiq
          ambientLiq,
          0, // bidTick
          0, // askTick
          parseFloat(userLiquidity.time), // weightedAverageDuration
          parseFloat(userLiquidity.liq), // netCumulativeLiquidity
        );
        return {
          ambientLiq,
          time: userLiquidity.time,
          transactionHash: userLiquidity.transactionHash,
          concLiq: '0',
          rewardLiq: '0',
          baseQty: ambientTokens.baseQty,
          quoteQty: ambientTokens.quoteQty,
          aggregatedLiquidity: userLiquidity.liq,
          aggregatedBaseFlow: userLiquidity.baseFlow,
          aggregatedQuoteFlow: userLiquidity.quoteFlow,
          positionType: userLiquidity.positionType,
          bidTick: userLiquidity.bidTick,
          askTick: userLiquidity.askTick,
          aprDuration: apr.aprDuration,
          aprPostLiq: apr.aprPostLiq,
          aprContributedLiq: apr.aprContributedLiq,
          aprEst: apr.aprEst,
        };
      }
      return null;
    }),
  );

  const aggregatedAmbientPosition = aggregatePositions(ambientPositionResults.filter(Boolean));

  const multicallData = concentratedPositions.flatMap((userLiquidity) => {
    const { bidTick, askTick } = userLiquidity;
    return [
      {
        target: queryContract.getAddress(),
        callData: queryContract.interface.encodeFunctionData('queryRangeTokens', [
          user,
          base,
          quote,
          poolIdx,
          bidTick,
          askTick,
        ]),
      },
      {
        target: queryContract.getAddress(),
        callData: queryContract.interface.encodeFunctionData('queryConcRewards', [
          user,
          base,
          quote,
          poolIdx,
          bidTick,
          askTick,
        ]),
      },
    ];
  });

  const multicallResults = await chain.multicall.tryAggregate.staticCall(true, multicallData);

  const concentratedPositionsResults = await Promise.all(
    concentratedPositions.map(async (userLiquidity, index) => {
      const rangeTokensResult = multicallResults[index * 2];
      const rewardLiqResult = multicallResults[index * 2 + 1];

      if (rangeTokensResult.success && rewardLiqResult.success) {
        const rangeTokens = parseRangeTokensResult(
          queryContract.interface.decodeFunctionResult('queryRangeTokens', rangeTokensResult.returnData),
        );
        const rewardLiq = parseRewardResult(
          queryContract.interface.decodeFunctionResult('queryConcRewards', rewardLiqResult.returnData),
        );

        if (!bignumber(rangeTokens.liq).isZero()) {
          const apr = calculateAPR(
            true, // isConcentrated
            rewardLiq.liqRewards, // rewardLiq
            rangeTokens.liq, // concLiq
            '0', // ambientLiq
            userLiquidity.bidTick, // bidTick
            userLiquidity.askTick, // askTick
            parseFloat(userLiquidity.time), // weightedAverageDuration
            parseFloat(userLiquidity.liq), // netCumulativeLiquidity
          );

          return {
            ambientLiq: '0',
            time: userLiquidity.time,
            transactionHash: userLiquidity.transactionHash,
            concLiq: rangeTokens.liq,
            rewardLiq: rewardLiq.liqRewards,
            baseQty: rangeTokens.baseQty,
            quoteQty: rangeTokens.quoteQty,
            aggregatedLiquidity: userLiquidity.liq.toString(),
            aggregatedBaseFlow: userLiquidity.baseFlow.toString(),
            aggregatedQuoteFlow: userLiquidity.quoteFlow.toString(),
            positionType: userLiquidity.positionType,
            bidTick: userLiquidity.bidTick,
            askTick: userLiquidity.askTick,
            aprDuration: apr.aprDuration,
            aprPostLiq: apr.aprPostLiq,
            aprContributedLiq: apr.aprContributedLiq,
            aprEst: apr.aprEst,
          };
        }
      }
      return null;
    }),
  );

  return [aggregatedAmbientPosition, ...concentratedPositionsResults.filter(Boolean)];
}
