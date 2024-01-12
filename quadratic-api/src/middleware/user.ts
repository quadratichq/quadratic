import { NextFunction, Request, Response } from 'express';
import { getUsersFromAuth0 } from '../auth0/profile';
import dbClient from '../dbClient';
import { RequestWithAuth, RequestWithOptionalAuth, RequestWithUser } from '../types/Request';

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

  // And now we have some extra work to do if it's their first time logging in

  // Lookup their email in auth0
  const usersById = await getUsersFromAuth0([{ id: newUser.id, auth0Id: auth0Id }]);
  const { email } = usersById[newUser.id];

  // See if they've been invited to any teams and make them team members
  const teamInvites = await dbClient.teamInvite.findMany({
    where: {
      email,
    },
  });
  if (teamInvites.length) {
    await dbClient.teamInvite.deleteMany({
      where: {
        email,
      },
    });
    await dbClient.userTeamRole.createMany({
      data: teamInvites.map(({ teamId, role }) => ({
        teamId,
        userId: newUser.id,
        role,
      })),
    });
  }

  // Do the same as teams, but with files
  const fileInvites = await dbClient.fileInvite.findMany({
    where: {
      email,
    },
  });
  if (fileInvites.length) {
    await dbClient.fileInvite.deleteMany({
      where: {
        email,
      },
    });
    await dbClient.userFileRole.createMany({
      data: fileInvites.map(({ fileId, role }) => ({
        fileId,
        userId: newUser.id,
        role,
      })),
    });
  }

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
