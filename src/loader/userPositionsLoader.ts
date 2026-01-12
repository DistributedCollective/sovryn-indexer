import dayjs from 'dayjs';
import { ethers } from 'ethers';
import { bignumber } from 'mathjs';

import { Chain } from './networks/chain-config';

import { ERC20__factory, SdexQuery } from '~/artifacts/abis/types';
import {
  filterPositions,
  netCumulativeLiquidity,
  parseAmbientTokensResult,
  parseRangeTokensResult,
  parseRewardResult,
  weightedAverageDuration,
} from '~/utils/aggregationUtils';
import { calculateAPR } from '~/utils/aprCalculation';
import { logger } from '~/utils/logger';

export enum PositionType {
  ambient = 'ambient',
  concentrated = 'concentrated',
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

  const aggregatedAmbientPosition = await tryAmbientPosition(
    queryContract,
    rpc,
    user,
    base,
    quote,
    poolIdx,
    ambientPositions,
    chain,
  );

  // Group concentrated positions by (base, quote, poolIdx, bidTick, askTick)
  const groupedConcentratedPositions: { [key: string]: LiquidityChanges[] } = concentratedPositions.reduce(
    (acc: { [key: string]: LiquidityChanges[] }, pos) => {
      const key = `${pos.pool.base}-${pos.pool.quote}-${pos.pool.poolIdx}-${pos.bidTick}-${pos.askTick}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(pos);
      return acc;
    },
    {},
  );

  const multicallData = Object.values(groupedConcentratedPositions).flatMap((positions) => {
    const { bidTick, askTick } = positions[0];
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
    Object.values(groupedConcentratedPositions).map(async (positions, index) => {
      const latestPosition = positions[positions.length - 1];
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
            latestPosition.bidTick, // bidTick
            latestPosition.askTick, // askTick
            weightedAverageDuration(liquidityChanges), // weightedAverageDuration
            netCumulativeLiquidity(liquidityChanges), // netCumulativeLiquidity
          );

          return {
            base: base,
            quote: quote,
            poolIdx: latestPosition.pool.poolIdx,
            ambientLiq: '0',
            time: latestPosition.time,
            transactionHash: latestPosition.transactionHash,
            concLiq: rangeTokens.liq.toString(),
            rewardLiq: rewardLiq.liqRewards.toString(),
            baseQty: rangeTokens.baseQty.toString(),
            quoteQty: rangeTokens.quoteQty.toString(),
            aggregatedLiquidity: latestPosition.liq.toString(),
            aggregatedBaseFlow: latestPosition.baseFlow.toString(),
            aggregatedQuoteFlow: latestPosition.quoteFlow.toString(),
            positionType: latestPosition.positionType,
            bidTick: latestPosition.bidTick,
            askTick: latestPosition.askTick,
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

  const result = [...aggregatedAmbientPosition, ...concentratedPositionsResults.filter(Boolean)];

  return result;
}

async function tryAmbientPosition(
  queryContract: SdexQuery,
  rpc: ethers.JsonRpcProvider,
  user: string,
  base: string,
  quote: string,
  poolIdx: number,
  liquidityChanges: LiquidityChangesResponse['liquidityChanges'],
  chain: Chain,
) {
  const lpTokenAddress = await queryContract.queryPoolLpTokenAddress(base, quote, poolIdx);
  const tokenContract = ERC20__factory.connect(lpTokenAddress, rpc);

  const multicallData = [
    {
      target: queryContract.getAddress(),
      callData: queryContract.interface.encodeFunctionData('queryAmbientTokens', [user, base, quote, poolIdx]),
    },
    {
      target: queryContract.getAddress(),
      callData: queryContract.interface.encodeFunctionData('queryAmbientTokens', [
        lpTokenAddress,
        base,
        quote,
        poolIdx,
      ]),
    },
    {
      target: queryContract.getAddress(),
      callData: queryContract.interface.encodeFunctionData('queryAmbientPosition', [
        lpTokenAddress,
        base,
        quote,
        poolIdx,
      ]),
    },
    {
      target: tokenContract.getAddress(),
      callData: tokenContract.interface.encodeFunctionData('balanceOf', [user]),
    },
    {
      target: tokenContract.getAddress(),
      callData: tokenContract.interface.encodeFunctionData('totalSupply'),
    },
  ];

  const results = await chain.multicall.tryAggregate.staticCall(true, multicallData);

  const userAmbientTokens = parseAmbientTokensResult(
    queryContract.interface.decodeFunctionResult('queryAmbientTokens', results[0].returnData),
  );
  const lpAmbientTokens = parseAmbientTokensResult(
    queryContract.interface.decodeFunctionResult('queryAmbientTokens', results[1].returnData),
  );
  const ambientPosition = queryContract.interface.decodeFunctionResult('queryAmbientPosition', results[2].returnData);
  const lpTokenBalance = tokenContract.interface.decodeFunctionResult('balanceOf', results[3].returnData)[0].toString();
  const lpTokenTotalSupply = tokenContract.interface
    .decodeFunctionResult('totalSupply', results[4].returnData)[0]
    .toString();

  logger.info(
    {
      userAmbientTokens,
      lpAmbientTokens,
      lpTokenBalance,
      lpTokenTotalSupply,
      lpTokenAddress,
      ambientPosition,
    },
    `Fetched ambient position data for user ${user} on pool ${base}-${quote}#${poolIdx}`,
  );

  const ratio = bignumber(lpTokenBalance).dividedBy(bignumber(lpTokenTotalSupply) || 1);
  const ambientLiq = bignumber(userAmbientTokens.liq).plus(bignumber(lpAmbientTokens.liq).mul(ratio)).toFixed(0);
  const baseQty = bignumber(userAmbientTokens.baseQty).plus(bignumber(lpAmbientTokens.baseQty).mul(ratio)).toFixed(0);
  const quoteQty = bignumber(userAmbientTokens.quoteQty)
    .plus(bignumber(lpAmbientTokens.quoteQty).mul(ratio))
    .toFixed(0);

  if (bignumber(ambientLiq).gt(0)) {
    const item = liquidityChanges.shift();

    return [
      {
        base: base,
        quote: quote,
        poolIdx: poolIdx.toString(),
        ambientLiq,
        time: item ? item.time : dayjs().unix().toString(),
        transactionHash: item ? item.transactionHash : '',
        concLiq: '0',
        rewardLiq: '0',
        baseQty: baseQty,
        quoteQty: quoteQty,
        aggregatedLiquidity: ambientLiq,
        aggregatedBaseFlow: '0',
        aggregatedQuoteFlow: '0',
        positionType: PositionType.ambient,
        bidTick: 0,
        askTick: 0,
        aprDuration: '0',
        aprPostLiq: '0',
        aprContributedLiq: '0',
        aprEst: '0',
        lpTokenAddress,
        lpTokenBalance,
      },
    ];
  }

  return [];
}
