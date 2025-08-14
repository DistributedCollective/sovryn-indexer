import { Request, Response, NextFunction } from 'express';

import { networks } from 'loader/networks';
import { BadRequestError } from 'utils/custom-error';

export const chainNameAwareMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const network = networks.getNetwork(req.params.chain) ?? networks.getByChainId(Number(req.params.chain));

  if (!network) {
    throw new BadRequestError('Unsupported network: ' + req.params.chain);
  }

  req.app.locals.network = network;

  return next();
};
