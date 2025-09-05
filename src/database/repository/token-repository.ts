import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { ZeroAddress } from 'ethers';
import { groupBy } from 'lodash';
import { ERC20__factory } from '~/artifacts/abis/types';

import { db } from '~/database/client';
import { lower } from '~/database/helpers';
import { NewToken, tokens, usdDailyPricesTable } from '~/database/schema';
import { networks } from '~/loader/networks';
import { Chain } from '~/loader/networks/chain-config';
import { encode } from '~/utils/encode';
import { logger } from '~/utils/logger';

export const tokenRepository = {
  listForChain: (chainId: number) =>
    db
      .select()
      .from(tokens)
      .where(and(eq(tokens.chainId, chainId), eq(tokens.ignored, false))),
  listAllForChain: (chainId: number) => db.select().from(tokens).where(eq(tokens.chainId, chainId)),
  findAllByAddress: (address: string[], chainId?: number) =>
    db
      .select()
      .from(tokens)
      .where(
        and(
          chainId ? eq(tokens.chainId, chainId) : undefined,
          inArray(
            tokens.address,
            address.map((item) => item.toLowerCase()),
          ),
        ),
      ),
  getStablecoin: (chain: Chain) =>
    db.query.tokens.findFirst({
      where: and(eq(tokens.chainId, chain.chainId), eq(tokens.address, chain.stablecoinAddress)),
    }),
  getBitcoin: (chain: Chain) =>
    db.query.tokens.findFirst({
      where: and(eq(tokens.chainId, chain.chainId), eq(tokens.address, chain.bitcoinAddress)),
    }),
  getNativeCoin: (chain: Chain) =>
    db.query.tokens.findFirst({ where: and(eq(tokens.chainId, chain.chainId), eq(tokens.address, ZeroAddress)) }),
  findByAddress: (address: string, chainId?: number) =>
    db.query.tokens.findFirst({
      where: and(chainId ? eq(tokens.chainId, chainId) : undefined, eq(tokens.address, address.toLowerCase())),
    }),
  getBySymbol: (symbol: string, chainId: number) =>
    db.query.tokens.findFirst({
      where: and(eq(tokens.chainId, chainId), eq(sql`lower(${tokens.symbol})`, symbol.toLowerCase())),
    }),
  getByAddress(chainId: number, address: string) {
    return db.query.tokens.findFirst({
      where: and(eq(tokens.chainId, chainId), eq(lower(tokens.address), address.toLowerCase())),
      with: {
        usdDailyPrices: {
          columns: {
            value: true,
          },
          limit: 1,
          orderBy: desc(usdDailyPricesTable.tickAt),
        },
      },
    });
  },
  insertTokens(newTokens: NewToken[], prefill = false) {
    return db
      .insert(tokens)
      .values(newTokens.map((item) => ({ ...item, identifier: encode.tokenId(item.chainId, item.address) })))
      .onConflictDoNothing()
      .returning()
      .then((result) => (prefill ? handleDecimals(result) : result));
  },
};

const erc20 = ERC20__factory.createInterface();

async function handleDecimals(newTokens: NewToken[]) {
  const items = newTokens.filter((t) => !t.processed && t.address !== ZeroAddress);
  const byChains = groupBy(items, (t) => t.chainId);

  for (const chainId of Object.keys(byChains)) {
    const chain = networks.getByChainId(Number(chainId));
    if (!chain) continue;
    const items = byChains[Number(chainId)];

    if (items.length) {
      const decimals = await chain.multicall.tryAggregate
        .staticCall(
          true,
          items.flatMap((t) => [
            {
              target: t.address,
              callData: erc20.encodeFunctionData('decimals'),
            },
          ]),
        )
        .then((result) =>
          result.map((r) => (r.success ? erc20.decodeFunctionResult('decimals', r.returnData)[0] : null)),
        );

      const symbols = await chain.multicall.tryAggregate
        .staticCall(
          true,
          items.flatMap((t) => [
            {
              target: t.address,
              callData: erc20.encodeFunctionData('symbol'),
            },
          ]),
        )
        .then((result) =>
          result.map((r) => (r.success ? erc20.decodeFunctionResult('symbol', r.returnData)[0] : null)),
        );

      const names = await chain.multicall.tryAggregate
        .staticCall(
          true,
          items.flatMap((t) => [
            {
              target: t.address,
              callData: erc20.encodeFunctionData('name'),
            },
          ]),
        )
        .then((result) => result.map((r) => (r.success ? erc20.decodeFunctionResult('name', r.returnData)[0] : null)));

      const toUpdate = items.map((t, i) => [t.id, decimals[i], symbols[i], names[i]]);
      const tuples = sql.join(
        toUpdate.map((t) => sql`(${t[0]}::int, ${t[1]}::int, ${t[2]}::text, ${t[3]}::text, true::boolean)`),
        sql`,`,
      );

      const q = sql`UPDATE ${tokens} AS p SET decimals = v.decimals, symbol = v.symbol, name = v.name, processed = v.processed FROM (VALUES ${tuples}) AS v(id, decimals, symbol, name, processed) WHERE p.id = v.id`;
      await db.execute(q);
    }
  }

  return newTokens;
}
