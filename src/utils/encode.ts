import { createHash } from 'crypto';

const sha256 = (data: string) => createHash('sha256').update(data).digest('hex');
const identity = (data: (string | number)[]) =>
  createHash('sha256').update(data.map(String).join('|').toLowerCase()).digest('hex');

export const encode = {
  identity,
  sha256,

  // helper for deterministic token IDs
  tokenId: (chainId: number, address: string) => identity([chainId, address.toLowerCase()]),
};
