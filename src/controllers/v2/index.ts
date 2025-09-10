import { Router, Request, Response } from 'express';

import poolsController from './pools';
import swapsController from './swaps';
import tickersController from './tickers';
import tokensController from './tokens';
import usersController from './users';

import { userAwareMiddleware } from '~/middleware/user-address-middleware';
import { toResponse } from '~/utils/http-response';
import { asyncRoute } from '~/utils/route-wrapper';

const router = Router();

router.get(
  '/',
  asyncRoute(async (req: Request, res: Response) => res.json(toResponse(req.app.locals.network))),
);

router.use('/tokens', tokensController);
router.use('/tickers', tickersController);
router.use('/pools', poolsController);
router.use('/swaps', swapsController);
router.use('/users/:address', userAwareMiddleware, usersController);

export default router;
