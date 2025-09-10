import { and, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { Router, Request, Response } from 'express';

import { DEFAULT_CACHE_TTL } from '~/config/constants';
import { db } from '~/database/client';
import { poolLiquidityChangesTable, poolPositionsTable, poolsTable, tokens } from '~/database/schema';
import { maybeCacheResponse } from '~/utils/cache';
import { toPaginatedResponse } from '~/utils/http-response';
import { createApiQuery, OrderBy, validatePaginatedRequest } from '~/utils/pagination';
import { asyncRoute } from '~/utils/route-wrapper';

const router = Router();

router.get(
  '/positions',
  asyncRoute(async (req: Request, res: Response) => {
    const chainId = req.app.locals.network.chainId;
    const user = req.app.locals.address;

    const p = validatePaginatedRequest(req);
    const cacheKey = `/v2/${chainId}/users/${user}/positions/${p.limit}/${p.cursor}`;

    return maybeCacheResponse(
      res,
      cacheKey,
      async () => {
        const baseToken = alias(tokens, 'base_token');
        const quoteToken = alias(tokens, 'quote_token');
        const baseChanges = alias(poolLiquidityChangesTable, 'base_changes');
        const quoteChanges = alias(poolLiquidityChangesTable, 'quote_changes');

        const query = db
          .select({
            id: poolPositionsTable.id,
            position: sql`${poolPositionsTable.identifier}`.as('position'),
            pool: sql`${poolsTable.legacyIdentifier}`.as('pool'),
            baseAddress: sql`${baseToken.address}`.as('baseAddress'),
            quoteAddress: sql`${quoteToken.address}`.as('quoteAddress'),
            baseSymbol: sql`${baseToken.symbol}`.as('baseSymbol'),
            quoteSymbol: sql`${quoteToken.symbol}`.as('quoteSymbol'),
            baseFlow:
              sql<string>`sum(case when ${baseChanges.type} = 'deposit' then ${baseChanges.tokenAmount}::numeric when ${baseChanges.type} = 'withdraw' then -${baseChanges.tokenAmount}::numeric end)`.as(
                'baseFlow',
              ),
            quoteFlow:
              sql<string>`sum(case when ${quoteChanges.type} = 'deposit' then ${quoteChanges.tokenAmount}::numeric when ${quoteChanges.type} = 'withdraw' then -${quoteChanges.tokenAmount}::numeric end)`.as(
                'quoteFlow',
              ),
            extra: poolPositionsTable.extra,
            createdAt: poolPositionsTable.createdAt,
          })
          .from(poolPositionsTable)
          .where(and(eq(poolPositionsTable.chainId, chainId), eq(poolPositionsTable.user, user)))
          .innerJoin(poolsTable, eq(poolsTable.identifier, poolPositionsTable.poolId))
          .innerJoin(baseToken, eq(baseToken.id, sql`${poolsTable.baseId}`))
          .innerJoin(quoteToken, eq(quoteToken.id, sql`${poolsTable.quoteId}`))
          .innerJoin(
            baseChanges,
            and(
              eq(baseChanges.positionId, poolPositionsTable.identifier),
              eq(baseChanges.tokenId, sql`${poolsTable.baseIdentifier}`),
            ),
          )
          .innerJoin(
            quoteChanges,
            and(
              eq(quoteChanges.positionId, poolPositionsTable.identifier),
              eq(quoteChanges.tokenId, sql`${poolsTable.quoteIdentifier}`),
            ),
          )
          .groupBy(
            poolPositionsTable.id,
            sql`${poolsTable.legacyIdentifier}`,
            sql`${poolPositionsTable.identifier}`,
            sql`${baseToken.address}`,
            sql`${quoteToken.address}`,
            sql`${baseToken.symbol}`,
            sql`${quoteToken.symbol}`,
            poolPositionsTable.extra,
            poolPositionsTable.createdAt,
          )
          .$dynamic();

        const api = createApiQuery('id', OrderBy.desc, (key) => poolPositionsTable[key], p);
        const items = await api.applyPagination(query).execute();

        return api.getMetadata(items);
      },
      DEFAULT_CACHE_TTL,
    ).then((data) => res.json(toPaginatedResponse(data)));
  }),
);

router.get(
  '/positions/:position',
  asyncRoute(async (req: Request, res: Response) => {
    const chainId = req.app.locals.network.chainId;
    const user = req.app.locals.address;
    const position = req.params.position;

    const p = validatePaginatedRequest(req);
    const cacheKey = `/v2/${chainId}/users/${user}/positions/${position}/${p.limit}/${p.cursor}`;

    return maybeCacheResponse(
      res,
      cacheKey,
      async () => {
        const token = alias(tokens, 'token');

        const query = db
          .select({
            id: poolLiquidityChangesTable.id,
            identifier: poolLiquidityChangesTable.identifier,
            token: token.symbol,
            tokenAddress: token.address,
            tokenDecimals: token.decimals,
            tokenAmount: poolLiquidityChangesTable.tokenAmount,
            type: poolLiquidityChangesTable.type,
            provider: poolLiquidityChangesTable.provider,
            transactionsHash: poolLiquidityChangesTable.transactionHash,
            extra: poolLiquidityChangesTable.extra,
            createdAt: poolLiquidityChangesTable.createdAt,
          })
          .from(poolLiquidityChangesTable)
          .where(
            and(
              eq(poolLiquidityChangesTable.chainId, chainId),
              eq(poolLiquidityChangesTable.user, user),
              eq(poolLiquidityChangesTable.positionId, position),
            ),
          )
          .innerJoin(token, eq(token.identifier, sql`${poolLiquidityChangesTable.tokenId}`))
          .$dynamic();

        const api = createApiQuery('id', OrderBy.desc, (key) => poolPositionsTable[key], p);
        const items = await api.applyPagination(query).execute();

        return api.getMetadata(items);
      },
      DEFAULT_CACHE_TTL,
    ).then((data) => res.json(toPaginatedResponse(data)));
  }),
);

export default router;
