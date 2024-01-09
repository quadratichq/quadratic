import { NextFunction, Response } from 'express';
import dbClient from '../dbClient';
import { Request } from '../types/Request';
import { ApiError } from '../utils/ApiError';
import { getFilePermissions } from '../utils/permissions';

// TODO: eventually we can get rid of this and use `getFile` instead
export const fileMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // TODO: validate UUID
  if (req.params.uuid === undefined) {
    return res.status(400).json({ error: { message: 'Invalid file UUID' } });
  }

  const file = await dbClient.file.findUnique({
    where: {
      uuid: req.params.uuid,
    },
  });

  if (file === null) {
    return res.status(404).json({ error: { message: 'File not found' } });
  }

  if (file.deleted) {
    return res.status(400).json({ error: { message: 'File has been deleted' } });
  }

  if (file.ownerUserId !== req?.user?.id) {
    if (file.publicLinkAccess === 'NOT_SHARED') {
      return res.status(403).json({ error: { message: 'Permission denied' } });
    }
  }

  req.quadraticFile = file;
  next();
};

export const getFile = async ({ uuid, userId }: { uuid: string; userId?: number }) => {
  const file = await dbClient.file.findUnique({
    where: {
      uuid,
    },
    include: {
      team: {
        include: {
          UserTeamRole: {
            where: {
              userId: userId,
            },
          },
        },
      },
      UserFileRole: {
        where: {
          userId,
        },
      },
    },
  });

  if (file === null) {
    throw new ApiError(404, 'File not found');
  }

  if (file.deleted) {
    throw new ApiError(400, 'File has been deleted');
  }

  const isFileOwner = !file.teamId && file.ownerUserId === userId;
  const teamRole = file.team && file.team.UserTeamRole[0] ? file.team.UserTeamRole[0].role : undefined;
  const fileRole = file.UserFileRole[0] ? file.UserFileRole[0].role : undefined;

  const filePermissions = getFilePermissions({
    fileRole,
    teamRole,
    publicLinkAccess: file.publicLinkAccess,
    isFileOwner,
  });

  if (!filePermissions.includes('FILE_VIEW')) {
    throw new ApiError(403, 'Permission denied');
  }

  // TODO: clean up naming, probably use fileRole, teamRole, permissionFile, permissionTeam
  return {
    file,
    userMakingRequest: { filePermissions, fileRole, teamRole, id: userId, isFileOwner },
  };
};
