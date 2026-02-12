import { Router } from 'express';

import { prepareSummary } from './cmc.utils';

import { DEFAULT_CACHE_TTL } from '~/config/constants';
import { networks } from '~/loader/networks';
import { NetworkFeature } from '~/loader/networks/types';
import { prepareTvlEndpoint, prepareTvlSummaryEndpoint } from '~/loader/tvl/prepare-tvl-endpoint-data';
import { networkAwareMiddleware } from '~/middleware/network-middleware';
import { maybeCacheResponse } from '~/utils/cache';
import { toResponse } from '~/utils/http-response';
import { asyncRoute } from '~/utils/route-wrapper';

const router = Router();

router.get(
  '/summary',
  asyncRoute(async (req, res) =>
    maybeCacheResponse(res, 'vf:legacy/cmc/summary', async () => prepareSummary(), DEFAULT_CACHE_TTL).then((data) =>
      res.json(toResponse(data)),
    ),
  ),
);

router.get(
  '/tvl',
  networkAwareMiddleware([NetworkFeature.legacy, NetworkFeature.sdex]),
  asyncRoute(async (req, res) =>
    maybeCacheResponse(
      res,
      `vf:legacy/cmc/tvl/${req.app.locals.network.name}`,
      async () => prepareTvlEndpoint(req.app.locals.network),
      DEFAULT_CACHE_TTL,
    ).then((data) => res.json(toResponse(data))),
  ),
);

router.get(
  '/tvl/summary',
  asyncRoute(async (req, res) =>
    maybeCacheResponse(
      res,
      'vf:legacy/cmc/tvl/summary',
      async () => prepareTvlSummaryEndpoint(networks.listChains()),
      DEFAULT_CACHE_TTL,
    ).then((data) => res.json(toResponse(data))),
  ),
);

export default router;
