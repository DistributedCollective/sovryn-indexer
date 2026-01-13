import { isNil } from 'lodash';
import { bignumber } from 'mathjs';

import { loadPrevSnapshot } from '~/cronjobs/legacy/tvl-snapshot';
import { tvlRepository } from '~/database/repository/tvl-repository';
import { TvlGroup } from '~/database/schema';
import { Chain } from '~/loader/networks/chain-config';
import { NetworkFeature } from '~/loader/networks/types';
import { findUsdPrice, getLastPrices } from '~/loader/price';
import { logger } from '~/utils/logger';
import { prettyNumber } from '~/utils/numbers';

function makeGroups(chain: Chain) {
  if (chain.hasFeature(NetworkFeature.legacy) && chain.hasFeature(NetworkFeature.sdex)) {
    return Object.values(TvlGroup);
  }
  if (chain.hasFeature(NetworkFeature.sdex)) {
    return [TvlGroup.staking, TvlGroup.sdex];
  }
  if (chain.hasFeature(NetworkFeature.legacy)) {
    return [
      TvlGroup.amm,
      TvlGroup.lending,
      TvlGroup.protocol,
      TvlGroup.subprotocol,
      TvlGroup.zero,
      TvlGroup.mynt,
      TvlGroup.staking,
      TvlGroup.fish,
    ];
  }
  return [];
}

/**
 * Build an "empty" TVL object for a chain based on its features.
 */
function makeEmptyTvlOutput(chain: Chain) {
  const output: any = {
    total_usd: '0',
    updatedAt: new Date(),
  };

  makeGroups(chain).forEach((item) => {
    output[item] = {
      totalUsd: '0',
    };
  });

  return output;
}

/**
 * TVL endpoint: now prefers snapshot (from cron),
 * falls back to computing from DB if snapshot is missing.
 */
export async function prepareTvlEndpoint(chain: Chain) {
  // 1) Try snapshot first – this guarantees consistency if cron writes atomically
  // const snapshot = await loadPrevSnapshot(chain.chainId);

  // logger.info({ chain: chain.name, hasSnapshot: !!snapshot, data: snapshot }, 'Preparing TVL endpoint data');

  // if (snapshot?.data) {
  //   const output = snapshot.data as any;

  //   // Ensure base shape is correct even if snapshot is slightly older schema
  //   if (isNil(output.total_usd)) {
  //     output.total_usd = '0';
  //   }
  //   if (isNil(output.updatedAt)) {
  //     // store ISO in snapshot; here we can convert or just pass through
  //     output.updatedAt = new Date().toISOString();
  //   }

  //   const requiredGroups = makeGroups(chain);
  //   for (const g of requiredGroups) {
  //     if (!output[g]) {
  //       output[g] = { totalUsd: '0' };
  //     } else if (isNil(output[g].totalUsd)) {
  //       output[g].totalUsd = '0';
  //     }
  //   }

  //   return output;
  // }

  // 2) Fallback: legacy behaviour (compute on the fly from DB)
  const data = await tvlRepository.loadAll(chain.chainId).execute();
  const output = makeEmptyTvlOutput(chain);
  const priceList = await getLastPrices();

  data.forEach((item) => {
    if (!isNil(output[item.group])) {
      const entry = {
        assetName: item.symbol.split('_')[0],
        contract: item.contract,
        asset: item.asset,
        balance: prettyNumber(item.balance),
        balanceUsd: prettyNumber(bignumber(item.balance).mul(findUsdPrice(item.tokenId, priceList))),
      };

      output[item.group][item.name] = entry;

      // Increment tvl usd group
      if (!isNaN(output[item.group].totalUsd)) {
        output[item.group].totalUsd = prettyNumber(bignumber(output[item.group].totalUsd).add(entry.balanceUsd));
      }

      // Increment tvl usd total
      if (output.total_usd) {
        output.total_usd = prettyNumber(bignumber(output.total_usd).add(entry.balanceUsd));
      }
    }
  });

  return output;
}

/**
 * Summary over all chains – now effectively aggregates snapshots,
 * because prepareTvlEndpoint() prefers snapshot.
 */
export async function prepareTvlSummaryEndpoint(chains: Chain[]) {
  const items = await Promise.all(chains.map((chain) => prepareTvlEndpoint(chain)));

  const output: any = {
    totalUsd: '0',
    updatedAt: new Date(),
    chains: chains.map((chain) => ({
      chainId: chain.chainId,
      name: chain.name,
      totalUsd: '0',
    })),
    features: {},
  };

  const groups = Object.values(TvlGroup);

  groups.forEach((item) => {
    output.features[item] = {
      totalUsd: '0',
    };
  });

  items.forEach((item, index) => {
    logger.info({ item, index }, 'Tvl data');
    groups.forEach((group) => {
      if (!isNil(item[group])) {
        output.features[group].totalUsd = prettyNumber(
          bignumber(output.features[group].totalUsd).add(item[group].totalUsd),
        );
      }
    });

    // item.total_usd is the per-chain total
    output.totalUsd = prettyNumber(bignumber(output.totalUsd).add(item.total_usd));
    output.chains[index].totalUsd = prettyNumber(item.total_usd);
  });

  return output;
}
