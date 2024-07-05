import { Router } from 'express';

import { LONG_CACHE_TTL } from 'config/constants';
import { maybeCacheResponse } from 'utils/cache';
import { toResponse } from 'utils/http-response';
import { asyncRoute } from 'utils/route-wrapper';

import { prepareSummary, prepareTvl } from './cmc.utils';

const router = Router();

router.get(
  '/summary',
  asyncRoute(async (req, res) =>
    maybeCacheResponse(res, 'legacy/cmc/summary', async () => prepareSummary(), LONG_CACHE_TTL).then((data) =>
      res.json(toResponse(data)),
    ),
  ),
);

router.get(
  '/tvl',
  asyncRoute(async (req, res) =>
    maybeCacheResponse(res, 'legacy/cmc/tvl___', async () => prepareTvl(), 1).then((data) =>
      res.json(toResponse(data)),
    ),
  ),
);

export default router;
