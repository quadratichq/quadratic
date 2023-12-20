import { NextFunction, Request, Response } from 'express';
import dbClient from '../dbClient';
import { RequestWithAuth, RequestWithOptionalAuth, RequestWithUser } from '../types/Request';

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
