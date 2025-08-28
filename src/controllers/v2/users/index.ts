import { Router, Request, Response } from 'express';

import { asyncRoute } from '~/utils/route-wrapper';

const router = Router();

router.get(
  '/pools',
  asyncRoute(async (req: Request, res: Response) => {
    return res.json({ nt: req.app.locals.network });
  }),
);

export default router;
