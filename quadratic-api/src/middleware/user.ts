import { NextFunction, Request, Response } from 'express';
import dbClient from '../dbClient';
import { RequestWithAuth, RequestWithOptionalAuth, RequestWithUser } from '../types/Request';

const getOrCreateUser = async (auth0Id: string) => {
  // get user from db
  const user = await dbClient.user.upsert({
    where: {
      auth0Id,
    },
    update: {},
    create: {
      auth0Id,
    },
  });

  return user;
};

export const userMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const { auth } = req as RequestWithAuth;

  const user = await getOrCreateUser(auth.sub);
  if (!user) {
    return res.status(500).json({ error: { message: 'Unable to get authenticated user' } });
  }

  (req as RequestWithUser).user = user;
  next();
};

export const getUserFromRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { auth } = req as RequestWithAuth;

    const user = await getOrCreateUser(auth.sub);
    if (!user) {
      return res.status(500).json({ error: { message: 'Unable to get authenticated user' } });
    }

    return user;
  } catch (error) {
    next(error);
  }
};

export const userOptionalMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const { auth } = req as RequestWithOptionalAuth;

  if (auth && auth.sub) {
    const user = await getOrCreateUser(auth.sub);
    if (!user) {
      return res.status(500).json({ error: { message: 'Unable to get authenticated user' } });
    }
    // @ts-expect-error
    req.user = user;
  }

  next();
};
