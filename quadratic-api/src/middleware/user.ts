import type { NextFunction, Request, Response } from 'express';
import { getUsers } from '../auth/auth';
import dbClient from '../dbClient';
import { addUserToTeam } from '../internal/addUserToTeam';
import type { RequestWithAuth, RequestWithOptionalAuth, RequestWithUser } from '../types/Request';
import logger from '../utils/logger';

const runFirstTimeUserLogic = async (user: Awaited<ReturnType<typeof dbClient.user.create>>) => {
  const { id: userId, auth0Id } = user;

  // Lookup their email in auth0
  const usersById = await getUsers([{ id: userId, auth0Id }]);
  const { email } = usersById[userId];

  if (email) {
    try {
      await dbClient.user.update({
        where: {
          auth0Id,
        },
        data: {
          email,
        },
      });
    } catch (error) {
      logger.error(`Error updating user email for user ${auth0Id}`, error);
    }
  }

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

const getOrCreateUser = async (auth0Id: string) => {
  // First try to get the user
  const user = await dbClient.user.findUnique({
    where: {
      auth0Id,
    },
  });

  if (user) {
    return { user, userCreated: false };
  }

  // If they don't exist yet, create them
  const newUser = await dbClient.user.create({
    data: {
      auth0Id,
    },
  });
  // Do extra work since it's their first time logging in
  await runFirstTimeUserLogic(newUser);

  // Return the user
  return { user: newUser, userCreated: true };
};

export const userMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const { auth } = req as RequestWithAuth;

  const { user, userCreated } = await getOrCreateUser(auth.sub);
  if (!user) {
    return res.status(500).json({ error: { message: 'Unable to get authenticated user' } });
  }

  (req as RequestWithUser).user = user;
  (req as RequestWithUser).userCreated = userCreated === true;
  next();
};

export const userOptionalMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const { auth } = req as RequestWithOptionalAuth;

  if (auth && auth.sub) {
    const { user } = await getOrCreateUser(auth.sub);
    if (!user) {
      return res.status(500).json({ error: { message: 'Unable to get authenticated user' } });
    }

    (req as RequestWithUser).user = user;
  }

  next();
};
