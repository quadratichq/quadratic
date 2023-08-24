import { NextFunction, Response } from 'express';
import { getAuth0User } from '../auth0/profile';
import dbClient from '../dbClient';
import { Request } from '../types/Request';

const getOrCreateUser = async (auth0_id: string) => {
  // get user from db
  let user = await dbClient.user.findUnique({
    where: {
      auth0_id,
    },
  });

  // if not user, create user
  if (user === null) {
    user = await dbClient.user.create({
      data: {
        auth0_id,
      },
    });
  }

  // update Auth0 data if it's been more than 24 hours
  if (
    user.auth0_data_last_updated === null ||
    user.auth0_data_last_updated.getTime() < Date.now() - 24 * 60 * 60 * 1000
  ) {
    const auth0User = await getAuth0User(auth0_id);

    return dbClient.user.update({
      where: {
        id: user.id,
      },
      data: {
        auth0_data: auth0User as any,
        auth0_data_last_updated: new Date(),
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
