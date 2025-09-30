import type { Request, Response } from 'express';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { getFilePermissions } from '../../utils/permissions';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(), // team uuid
    fileUuid: z.string().uuid(), // file uuid
  }),
  body: z.object({
    action: z.literal('undelete'),
  }),
});

async function handler(req: Request, res: Response<any>) {
  const {
    params: { uuid: teamUuid, fileUuid },
    body: { action },
  } = parseRequest(req, schema);
  const {
    user: { id: userMakingRequestId },
  } = req as RequestWithUser;

  // Verify team access
  const { team, userMakingRequest } = await getTeam({ uuid: teamUuid, userId: userMakingRequestId });

  // Find the file and verify it belongs to this team
  const file = await dbClient.file.findUnique({
    where: {
      uuid: fileUuid,
    },
    include: {
      UserFileRole: {
        where: {
          userId: userMakingRequestId,
        },
      },
    },
  });

  if (!file) {
    throw new ApiError(404, 'File not found');
  }

  if (file.ownerTeamId !== team.id) {
    throw new ApiError(404, 'File not found in this team');
  }

  if (!file.deleted) {
    throw new ApiError(400, 'File is not deleted');
  }

  // Check if user has access to this file
  // Don't return files that are private to other users
  if (file.ownerUserId && file.ownerUserId !== userMakingRequestId) {
    throw new ApiError(403, 'Permission denied');
  }

  // Check file permissions for un-delete operation
  const filePermissions = getFilePermissions({
    publicLinkAccess: file.publicLinkAccess,
    userFileRelationship: {
      context: file.ownerUserId === userMakingRequestId ? 'private-to-me' : 'public-to-team',
      teamRole: userMakingRequest.role,
      fileRole: file.UserFileRole.find(({ userId }) => userId === userMakingRequestId)?.role,
    },
  });

  // For un-delete, we need FILE_DELETE permission (since we're reversing a delete)
  if (!filePermissions.includes('FILE_DELETE')) {
    throw new ApiError(403, 'Permission denied');
  }

  // Handle the un-delete action
  if (action === 'undelete') {
    const updatedFile = await dbClient.file.update({
      where: {
        uuid: fileUuid,
      },
      data: {
        deleted: false,
        deletedDate: null,
      },
    });

    const response = {
      message: 'File un-deleted successfully',
      file: {
        uuid: updatedFile.uuid,
        name: updatedFile.name,
        deleted: updatedFile.deleted,
        deletedDate: updatedFile.deletedDate?.toISOString() || null,
      },
    };

    return res.status(200).json(response);
  }

  // Unknown action
  throw new ApiError(400, 'Invalid action');
}
