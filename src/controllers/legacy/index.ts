import { Router } from 'express';

import ammRouter from './amm';
import cmcRouter from './cmc';

import { NetworkFeature } from '~/loader/networks/types';
import { networkAwareMiddleware } from '~/middleware/network-middleware';

const router = Router();

router.use('/amm', networkAwareMiddleware([NetworkFeature.legacy]), ammRouter);
router.use('/cmc', cmcRouter);

export default router;
