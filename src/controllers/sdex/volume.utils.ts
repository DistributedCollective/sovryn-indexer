import { bignumber } from 'mathjs';

import { swapRepositoryV2 } from 'database/repository/swap-repository-v2';
import { areAddressesEqual } from 'utils/compare';

export async function prepareSdexVolume(chainId: number, days = 1) {
  const last24hSwaps = await swapRepositoryV2.loadSwaps(days, chainId);

  const result: {
    token: string;
    volume: string;
  }[] = [];

  last24hSwaps.map((swap) => {
    const baseIndex = result.findIndex((s) => areAddressesEqual(s.token, swap.base.address));
    if (baseIndex < 0) {
      result.push({
        token: swap.base.address,
        volume: bignumber(swap.baseAmount)
          .mul(10 ** swap.base.decimals)
          .toFixed(0),
      });
    } else {
      result[baseIndex] = {
        token: swap.base.address,
        volume: bignumber(swap.baseAmount)
          .mul(10 ** swap.base.decimals)
          .plus(result[baseIndex].volume)
          .toFixed(0),
      };
    }

    const quoteIndex = result.findIndex((s) => areAddressesEqual(s.token, swap.quote.address));
    if (quoteIndex < 0) {
      result.push({
        token: swap.quote.address,
        volume: bignumber(swap.quoteAmount)
          .mul(10 ** swap.quote.decimals)
          .toFixed(0),
      });
    } else {
      result[quoteIndex] = {
        token: swap.quote.address,
        volume: bignumber(swap.quoteAmount)
          .mul(10 ** swap.quote.decimals)
          .plus(result[quoteIndex].volume)
          .toFixed(0),
      };
    }
  });

  return result;
}
