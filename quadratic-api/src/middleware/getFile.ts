import dbClient from '../dbClient';
import { ApiError } from '../utils/ApiError';
import { getFilePermissions, getTeamPermissions } from '../utils/permissions';

/**
 * Most of the time, `userId` will be defined because the user will be logged in.
 * However, in the case of a publicly-shared file, anonymous users can request
 * a file and we don't know who they are.
 */
export async function getFile<T extends number | undefined>({
  uuid,
  userId,
  allowDeleted,
}: {
  uuid: string;
  userId: T;
  allowDeleted?: boolean;
}) {
  const file = await dbClient.file.findUnique({
    where: {
      uuid,
    },
    include: {
      ownerTeam: {
        include: {
          UserTeamRole: {
            where: {
              userId,
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

  if (file.deleted && !allowDeleted) {
    throw new ApiError(410, 'File has been deleted');
  }

  // TODO: what if the team has been archived? We don't support this yet, but we
  // will one day when we implement archiving a team.

  // FYI: the included relational data is not always filtered on the `where`
  // clause because `userId` is possibly `undefined`
  const teamRole =
    file.ownerTeam && file.ownerTeam.UserTeamRole[0] && file.ownerTeam.UserTeamRole[0].userId === userId
      ? file.ownerTeam.UserTeamRole[0].role
      : undefined;
  const fileRole =
    file.UserFileRole[0] && file.UserFileRole[0].userId === userId ? file.UserFileRole[0].role : undefined;

  // Determine the user's relationship to the file
  let userFileRelationship: Parameters<typeof getFilePermissions>[0]['userFileRelationship'] = undefined;
  // Only define the relationship if they're logged in
  if (userId !== undefined) {
    if (file.ownerUserId === userId) {
      userFileRelationship = { context: 'private-to-me', teamRole };
    } else if (file.ownerUserId) {
      userFileRelationship = { context: 'private-to-someone-else', fileRole };
    } else {
      userFileRelationship = { context: 'public-to-team', teamRole, fileRole };
    }
  }

  const filePermissions = getFilePermissions({
    publicLinkAccess: file.publicLinkAccess,
    userFileRelationship,
  });

  if (!filePermissions.includes('FILE_VIEW')) {
    throw new ApiError(403, 'Permission denied');
  }

  const teamPermissions = teamRole ? getTeamPermissions(teamRole) : undefined;

  return {
    file,
    userMakingRequest: {
      filePermissions,
      fileRole,
      teamPermissions,
      teamRole,
      id: userId,
    },
  };
}
