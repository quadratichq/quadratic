import type { Request, Response } from 'express';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

async function handler(req: Request, res: Response<any>) {
  const {
    params: { uuid: fileUuid },
  } = parseRequest(req, schema);
  const {
    user: { id: userMakingRequestId },
  } = req as RequestWithUser;

  // Get the file and verify permissions
  // Note: getFile will throw if the file doesn't exist or user doesn't have access
  const {
    file,
    userMakingRequest: { filePermissions },
  } = await getFile({ uuid: fileUuid, userId: userMakingRequestId, allowDeleted: true });

  // Check if file is actually deleted
  if (!file.deleted) {
    throw new ApiError(400, 'File is not deleted');
  }

  // For restore, we need FILE_DELETE permission (since we're reversing a delete)
  if (!filePermissions.includes('FILE_DELETE')) {
    throw new ApiError(403, 'Permission denied');
  }

  // Restore the file
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
    message: 'File restored successfully',
    file: {
      uuid: updatedFile.uuid,
      name: updatedFile.name,
      deleted: updatedFile.deleted,
      deletedDate: updatedFile.deletedDate,
    },
  };

  return res.status(200).json(response);
}
