import { NextFunction, Response } from 'express';
import dbClient from '../dbClient';
import { Request } from '../types/Request';

const getOrCreateUser = async (auth0_id: string) => {
  // get user from db
  const user = await dbClient.user.findUnique({
    where: {
      auth0_id,
    },
  });

  // if not user, create user
  if (user === null) {
    return dbClient.user.create({
      data: {
        auth0_id,
      },
    });
  }

  return user;
};

export const userMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (req.auth?.sub === undefined) {
    return res.status(401).json({ error: { message: 'Invalid authorization token' } });
  }

  req.user = await getOrCreateUser(req.auth.sub);

  next();
};

export const userOptionalMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (req.auth?.sub === undefined) {
    return next();
  }

  req.user = await getOrCreateUser(req.auth.sub);

  next();
};
