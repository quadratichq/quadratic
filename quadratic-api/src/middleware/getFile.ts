import * as Sentry from '@sentry/node';
import dbClient from '../dbClient';
import { ApiError } from '../utils/ApiError';
import { getFilePermissions } from '../utils/permissions';

/**
 * Most of the time, `userId` will be defined because the user will be logged in.
 * However, in the case of a publicly-shared file, anonymous users can request
 * a file and we don't know who they are.
 */
export async function getFile<T extends number | undefined>({ uuid, userId }: { uuid: string; userId: T }) {
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

  if (file.deleted) {
    throw new ApiError(410, 'File has been deleted');
  }

  // FYI: the included relational data is not always filtered on the `where`
  // clause because `userId` is possibly `undefined`
  const isFileOwner = file.ownerUserId === userId;
  if (isFileOwner && file.ownerTeamId) {
    Sentry.captureException({
      message: 'File cannot be owned by a user and a team at the same time',
      extra: {
        fileUuid: file.uuid,
      },
    });
    throw new ApiError(500, 'File cannot be owned by a user and a team at the same time');
  }
  const teamRole =
    file.ownerTeam && file.ownerTeam.UserTeamRole[0] && file.ownerTeam.UserTeamRole[0].userId === userId
      ? file.ownerTeam.UserTeamRole[0].role
      : undefined;
  const fileRole =
    file.UserFileRole[0] && file.UserFileRole[0].userId === userId ? file.UserFileRole[0].role : undefined;

  //
  // TODO: probably want to use this as part of the `userMakingRequest` object
  // as it encompasses all _expected_ possibilities of the user's relationship
  // with the file (whereas, for example, `isFileOwner` being true and `teamRole`
  // having a value at the same time is considered an invalid combo in the codebase).
  let userFileRelationship: Parameters<typeof getFilePermissions>[0]['userFileRelationship'] = undefined;
  // Only define the relationship if they're logged in
  if (userId !== undefined) {
    if (isFileOwner) {
      userFileRelationship = { owner: 'me' };
    } else if (file.ownerUserId) {
      userFileRelationship = { owner: 'another-user', fileRole };
    } else if (file.ownerTeamId) {
      userFileRelationship = { owner: 'team', teamRole, fileRole };
    }
  }

  const filePermissions = getFilePermissions({
    publicLinkAccess: file.publicLinkAccess,
    userFileRelationship,
  });

  if (!filePermissions.includes('FILE_VIEW')) {
    throw new ApiError(403, 'Permission denied');
  }

  return {
    file,
    userMakingRequest: {
      filePermissions,
      fileRole,
      teamRole,
      id: userId,
      isFileOwner,
    },
  };
}
