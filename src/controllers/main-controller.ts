import dayjs from 'dayjs';
import { eq, and, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { Router, Request, Response } from 'express';
import Joi from 'joi';
import _ from 'lodash';
import { bignumber } from 'mathjs';

import { DEFAULT_CACHE_TTL } from '~/config/constants';
import { db } from '~/database/client';
import { lower } from '~/database/helpers';
import { tokens } from '~/database/schema';
import { chains } from '~/database/schema/chains';
import { constructCandlesticks, getPrices } from '~/loader/chart/utils';
import { networks } from '~/loader/networks';
import { getLastPrices } from '~/loader/price';
import { validateChainId } from '~/middleware/network-middleware';
import { maybeCacheResponse } from '~/utils/cache';
import { BadRequestError, NotFoundError } from '~/utils/custom-error';
import { toNearestCeilDate, toNearestDate } from '~/utils/date';
import { toPaginatedResponse, toResponse } from '~/utils/http-response';
import { logger } from '~/utils/logger';
import { prettyNumber } from '~/utils/numbers';
import { createApiQuery, OrderBy, validatePaginatedRequest } from '~/utils/pagination';
import { asyncRoute } from '~/utils/route-wrapper';
import { validate } from '~/utils/validation';

import { MAX_INTERVALS, Timeframe, TIMEFRAME_ROUNDING, TIMEFRAMES } from './main-controller.constants';

const router = Router();

router.get(
  '/chains',
  asyncRoute(async (req: Request, res: Response) =>
    maybeCacheResponse(
      res,
      'chains',
      async () =>
        networks.networks.map((network) => {
          const chain = networks.getNetwork(network);
          return {
            name: network,
            chainId: chain.chainId,
            features: chain.features,
          };
        }),
      DEFAULT_CACHE_TTL,
    ).then((data) => res.json(toResponse(data))),
  ),
);

router.get(
  '/tokens',
  asyncRoute(async (req: Request, res: Response) => {
    const chainId = validateChainId(req, true);
    const p = validatePaginatedRequest(req);
    return maybeCacheResponse(
      res,
      `tokens/${chainId ?? 0}/${p.limit}/${p.cursor}/${Boolean(req.query.spam) ? 'spam' : 'no-spam'}`,
      async () => {
        const quoteToken = alias(tokens, 'quote_token');
        const chain = alias(chains, 'chain');

        const tokenQuery = db
          .select({
            id: tokens.id,
            symbol: tokens.symbol,
            name: tokens.name,
            decimals: tokens.decimals,
            chainId: tokens.chainId,
            address: tokens.address,
            stablecoinId: sql<number>`${quoteToken.id}`.as('stablecoinId'),
          })
          .from(tokens)
          .where(
            and(
              chainId ? eq(tokens.chainId, chainId) : undefined,
              Boolean(req.query.spam) ? undefined : eq(tokens.ignored, false),
            ),
          )
          .innerJoin(chain, eq(tokens.chainId, chain.id))
          .innerJoin(quoteToken, and(eq(quoteToken.chainId, chain.id), eq(quoteToken.address, chain.stablecoinAddress)))
          .$dynamic();

        const api = createApiQuery('address', OrderBy.asc, (key) => tokens[key], p);
        const items = await api.applyPagination(tokenQuery).execute();

        const lastPrices = await getLastPrices();

        return api.getMetadata(
          items.map((item) => {
            const lastUsdPrice = lastPrices.find((price) => price.tokenId === item.id);
            const price = bignumber(lastUsdPrice?.value ?? 0);
            return {
              ...item,
              usdPrice: prettyNumber(price),
              usdPriceDate: lastUsdPrice?.updatedAt ?? lastUsdPrice?.tickAt ?? null,
              id: undefined,
              stablecoinId: undefined,
            };
          }),
        );
      },
      DEFAULT_CACHE_TTL,
    ).then((data) => res.json(toPaginatedResponse(data)));
  }),
);

router.get(
  '/tokens/:tokenAddress',
  asyncRoute(async (req: Request, res: Response) => {
    const { tokenAddress } = validate<{ tokenAddress: string }>(
      Joi.object({
        tokenAddress: Joi.string().required(),
      }),
      req.params,
      { allowUnknown: true },
    );
    const chainId = validateChainId(req, true);
    return maybeCacheResponse(
      res,
      `tokens/${chainId ?? 0}/${tokenAddress}`,
      async () => {
        const quoteToken = alias(tokens, 'quote_token');
        const chain = alias(chains, 'chain');

        const items = await db
          .select({
            id: tokens.id,
            symbol: tokens.symbol,
            name: tokens.name,
            decimals: tokens.decimals,
            chainId: tokens.chainId,
            address: tokens.address,
            stablecoinId: sql<number>`${quoteToken.id}`.as('stablecoinId'),
          })
          .from(tokens)
          .where(
            and(
              eq(lower(tokens.address), tokenAddress.toLowerCase()),
              chainId ? eq(tokens.chainId, chainId) : undefined,
            ),
          )
          .innerJoin(chain, eq(tokens.chainId, chain.id))
          .innerJoin(quoteToken, and(eq(quoteToken.chainId, chain.id), eq(quoteToken.address, chain.stablecoinAddress)))
          .limit(1)
          .execute();

        const lastPrices = await getLastPrices();

        const item =
          items.map((item) => {
            const lastUsdPrice = lastPrices.find((price) => price.tokenId === item.id)?.value ?? '0';
            return {
              ...item,
              usdPrice: prettyNumber(lastUsdPrice),
              id: undefined,
              stablecoinId: undefined,
            };
          })?.[0] ?? null;

        if (!item) {
          throw new NotFoundError('Token not found');
        }

        return item;
      },
      DEFAULT_CACHE_TTL,
    ).then((data) => res.json(toResponse(data)));
  }),
);

router.get(
  '/chart',
  asyncRoute(async (req: Request, res: Response) => {
    const chainId = validateChainId(req);
    const {
      base: baseTokenAddress,
      quote: quoteTokenAddress,
      start: startTimestamp,
      end: endTimestamp,
      timeframe,
    } = validate<{ base: string; quote: string; start: number; end: number; timeframe: Timeframe }>(
      Joi.object({
        chainId: Joi.required(),
        base: Joi.string().required(),
        quote: Joi.string().required(),
        start: Joi.number()
          .optional()
          .default((parent) =>
            dayjs
              .unix(parent.end ?? dayjs().unix())
              .subtract(Math.min(TIMEFRAMES[parent.timeframe ?? '1m'] * 30, 43200), 'minutes')
              .unix(),
          ),
        end: Joi.number()
          .optional()
          .default(() => dayjs().unix()),
        timeframe: Joi.string()
          .optional()
          .valid(...Object.keys(TIMEFRAMES))
          .default('1m'),
      }),
      req.query,
    );

    const start = toNearestCeilDate(dayjs.unix(startTimestamp).toDate(), TIMEFRAME_ROUNDING[timeframe]);
    const end = toNearestDate(dayjs.unix(endTimestamp).toDate(), TIMEFRAME_ROUNDING[timeframe]);

    const maxInterval = MAX_INTERVALS[timeframe];
    const intervals = (end.getTime() - start.getTime()) / (TIMEFRAMES[timeframe] * 60 * 1000);
    if (intervals > maxInterval) {
      throw new BadRequestError('Invalid arguments');
    }

    try {
      const intervals = await getPrices(chainId, baseTokenAddress, quoteTokenAddress, start, end, timeframe);
      const data = await constructCandlesticks(intervals, TIMEFRAMES[timeframe]);
      return res.json(toResponse(data));
    } catch (e) {
      logger.error(
        { e: e.message, stack: e.stack },
        `Failed to get chart data for ${baseTokenAddress}/${quoteTokenAddress} in ${timeframe}`,
      );
      return res.json(toResponse([]));
    }
  }),
);

router.get('/', (req, res) => res.json({ status: 'ok' }));
router.get('/status', (req, res) => res.json({ status: 'ok' }));

export default router;
