import { Router } from 'express';
import Joi from 'joi';

import { DEFAULT_CACHE_TTL } from 'config/constants';
import { maybeCacheResponse } from 'utils/cache';
import { toResponse } from 'utils/http-response';
import { validatePaginatedRequest } from 'utils/pagination';
import { asyncRoute } from 'utils/route-wrapper';
import { validate } from 'utils/validation';

import { prepareSdexVolume } from './volume.utils';

const router = Router();

const querySchema = Joi.object({
  user: Joi.string().required(),
  chainId: Joi.string().required(),
  base: Joi.string().required(),
  quote: Joi.string().required(),
  poolIdx: Joi.number().required(),
});

const swapHistoryQuerySchema = Joi.object({
  user: Joi.string().required(),
  chainId: Joi.string().required(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

router.get(
  '/pool_list',
  asyncRoute(async (req, res) => {
    const { cursor, limit } = validatePaginatedRequest(req);
    return maybeCacheResponse(
      res,
      `sdex/pool_list/${req.network.chainId}/${limit}/${cursor}`,
      async () =>
        req.network.sdex.queryPools(limit).then((data) =>
          data.pools.map((item) => ({
            chainId: req.network.chainId,
            base: item.base,
            quote: item.quote,
            poolIdx: Number(item.poolIdx),
          })),
        ),
      DEFAULT_CACHE_TTL,
    ).then((data) => res.json(toResponse(data)));
  }),
);

router.get(
  '/volume',
  asyncRoute(async (req, res) => {
    return maybeCacheResponse(
      res,
      `sdex/volume/${req.network.chainId}`,
      async () => prepareSdexVolume(req.network.chainId),
      DEFAULT_CACHE_TTL,
    ).then((data) => res.json(toResponse(data)));
  }),
);

router.get(
  '/user_pool_positions',
  asyncRoute(async (req, res) => {
    const { user, chainId, base, quote, poolIdx } = validate(querySchema, req.query);

    return maybeCacheResponse(
      res,
      `sdex/user_pool_positions/${chainId}/${user}/${base}/${quote}/${poolIdx}`,
      async () => {
        const liquidity = await req.network.sdex.getUpdatedLiquidity(user, base, quote, poolIdx);
        return {
          liquidity,
        };
      },
      DEFAULT_CACHE_TTL,
    ).then((data) => res.json(toResponse(data.liquidity)));
  }),
);

router.get(
  '/swaps',
  asyncRoute(async (req, res) => {
    const { user, chainId, cursor, limit } = validate(swapHistoryQuerySchema, req.query);

    const cacheKey = `sdex/swaps/${chainId}/${user}/${cursor || 0}/${limit}`;

    return maybeCacheResponse(
      res,
      cacheKey,
      async () => {
        const swaps = await req.network.sdex.querySwapsByUser(user, limit, cursor || 0);
        return swaps;
      },
      DEFAULT_CACHE_TTL,
    ).then((data) => res.json(toResponse(data)));
  }),
);

export default router;
