import type { NextFunction, Request, Response } from 'express';
import dbClient from '../dbClient';
import { addUserToTeam } from '../internal/addUserToTeam';
import type { Auth, RequestWithAuth, RequestWithOptionalAuth, RequestWithUser } from '../types/Request';

const runFirstTimeUserLogic = async (user: Awaited<ReturnType<typeof dbClient.user.create>>) => {
  const { id: userId, email } = user;

  // See if they've been invited to any teams and make them team members
  const teamInvites = await dbClient.teamInvite.findMany({
    where: {
      email,
    },
  });
  if (teamInvites.length) {
    for (const { teamId, role } of teamInvites) {
      await addUserToTeam({ userId, teamId, role });
    }
    await dbClient.teamInvite.deleteMany({
      where: {
        email,
      },
    });
  }

  // Do the same as teams, but with files
  const fileInvites = await dbClient.fileInvite.findMany({
    where: {
      email,
    },
  });
  if (fileInvites.length) {
    await dbClient.userFileRole.createMany({
      data: fileInvites.map(({ fileId, role }) => ({
        fileId,
        userId,
        role,
      })),
    });
    await dbClient.fileInvite.deleteMany({
      where: {
        email,
      },
    });
  }

  // Done.
};

const getOrCreateUser = async (auth: Auth) => {
  // First try to get the user
  let user;
  if (auth.email) {
    user = await dbClient.user.findUnique({
      where: {
        email: auth.email,
      },
    });
  } else if (auth.sub) {
    user = await dbClient.user.findUnique({
      where: {
        auth0Id: auth.sub,
      },
    });
  } else {
    return { user: null, userCreated: false };
  }

  if (user) {
    return { user, userCreated: false };
  }

  // If they don't exist yet, create them
  const newUser = await dbClient.user.create({
    data: {
      auth0Id: auth.sub,
      email: auth.email,
    },
  });
  // Do extra work since it's their first time logging in
  await runFirstTimeUserLogic(newUser);

  // Return the user
  return { user: newUser, userCreated: true };
};

export const userMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const { auth } = req as RequestWithAuth;
  if (!auth || (!auth.sub && !auth.email)) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  const { user, userCreated } = await getOrCreateUser(auth);
  if (!user) {
    return res.status(500).json({ error: { message: 'Unable to get authenticated user' } });
  }

  (req as RequestWithUser).user = user;
  (req as RequestWithUser).userCreated = userCreated === true;
  next();
};

export const userOptionalMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const { auth } = req as RequestWithOptionalAuth;
  if (!auth || (!auth.sub && !auth.email)) {
    return next();
  }

  const { user } = await getOrCreateUser(auth);
  if (user) {
    (req as RequestWithUser).user = user;
  }

  next();
};
