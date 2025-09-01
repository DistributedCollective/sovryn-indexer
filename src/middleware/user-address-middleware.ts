import { ethers } from 'ethers';
import { Request, Response, NextFunction } from 'express';

import { BadRequestError } from '~/utils/custom-error';

export const userAwareMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const address = req.params.address?.toLowerCase();

  if (!ethers.isAddress(address)) {
    throw new BadRequestError('Invalid user address');
  }

  req.app.locals.user = address;
  req.app.locals.address = address;

  return next();
};
