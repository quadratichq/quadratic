import dbClient from '../dbClient';
import { NextFunction, Response } from 'express';
import { Request } from '../types/Request';

export const userMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (req.auth?.sub === undefined) {
    return res.status(401).json({ error: { message: 'Invalid authorization token' } });
  }

  req.user = await dbClient.user.upsert({
    where: {
      auth0_id: req.auth.sub,
    },
    update: {},
    create: {
      auth0_id: req.auth.sub,
    },
  });

  next();
};
