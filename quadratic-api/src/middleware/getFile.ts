import dbClient from '../dbClient';
import { ApiError } from '../utils/ApiError';
import { getFilePermissions } from '../utils/permissions';

export const getFile = async ({ uuid, userId }: { uuid: string; userId?: number }) => {
  const file = await dbClient.file.findUnique({
    where: {
      uuid,
    },
    include: {
      ownerTeam: {
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

  const isFileOwner = !file.ownerTeamId && file.ownerUserId === userId;
  const teamRole = file.ownerTeam && file.ownerTeam.UserTeamRole[0] ? file.ownerTeam.UserTeamRole[0].role : undefined;
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
