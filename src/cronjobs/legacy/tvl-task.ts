import { CronJob } from 'cron';

import { buildLegacySnapshot, buildSdexSnapshot, saveSnapshotAtomic } from './tvl-snapshot';

import { networks } from '~/loader/networks';
import { LegacyChain } from '~/loader/networks/legacy-chain';
import { SdexChain } from '~/loader/networks/sdex-chain';
import { NetworkFeature } from '~/loader/networks/types';
import { logger } from '~/utils/logger';

const childLogger = logger.child({ module: 'crontab:tvl' });

export const tvlTask = async (ctx: CronJob) => {
  ctx.stop();
  childLogger.info('Retrieving TVL task');

  const items = networks.listChains();

  for (const item of items) {
    try {
      if (item.hasFeature(NetworkFeature.legacy)) {
        await handleLegacyChain(item.legacy);
      }

      if (item.hasFeature(NetworkFeature.sdex)) {
        await handleSdexChain(item.sdex);
      }
    } catch (err) {
      childLogger.error({ chain: item.chainId, err }, 'Failed to build/save TVL snapshot for chain');
    }
  }

  childLogger.info('TVL task retrieved.');
  ctx.start();
};

async function handleLegacyChain(chain: LegacyChain) {
  const chainId = chain.context.chainId;
  const snapshot = await buildLegacySnapshot(chain);
  await saveSnapshotAtomic(chainId, snapshot);
  childLogger.info({ chainId }, 'Legacy TVL snapshot updated');
}

async function handleSdexChain(chain: SdexChain) {
  const chainId = chain.context.chainId;
  const snapshot = await buildSdexSnapshot(chain);
  await saveSnapshotAtomic(chainId, snapshot);
  childLogger.info({ chainId }, 'Sdex TVL snapshot updated');
}
