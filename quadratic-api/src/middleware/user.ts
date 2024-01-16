import { NextFunction, Request, Response } from 'express';
import { getUsersFromAuth0 } from '../auth0/profile';
import dbClient from '../dbClient';
import { RequestWithAuth, RequestWithOptionalAuth, RequestWithUser } from '../types/Request';

const runFirstTimeUserLogic = async (user: Awaited<ReturnType<typeof dbClient.user.create>>) => {
  const { id, auth0Id } = user;

  // Lookup their email in auth0
  const usersById = await getUsersFromAuth0([{ id, auth0Id }]);
  const { email } = usersById[id];

  // See if they've been invited to any teams and make them team members
  const teamInvites = await dbClient.teamInvite.findMany({
    where: {
      email,
    },
  });
  if (teamInvites.length) {
    await dbClient.userTeamRole.createMany({
      data: teamInvites.map(({ teamId, role }) => ({
        teamId,
        userId: id,
        role,
      })),
    });
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
        userId: id,
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
    return user;
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
  return newUser;
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
