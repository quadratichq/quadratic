import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

export default [
  validateRequestSchema(
    z.object({
      params: z.object({
        uuid: z.string().uuid(),
      }),
    })
  ),
  validateAccessToken,
  userMiddleware,
  handler,
];

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/folders/:uuid.DELETE.response']>) {
  const {
    user: { id: userId },
  } = req;
  const folderUuid = req.params.uuid;

  // Get the folder
  const folder = await dbClient.folder.findUnique({
    where: { uuid: folderUuid },
  });

  if (!folder || folder.deleted) {
    throw new ApiError(404, 'Folder not found.');
  }

  // Check team access
  const folderTeam = await dbClient.team.findUnique({ where: { id: folder.ownerTeamId } });
  if (!folderTeam) {
    throw new ApiError(404, 'Team not found.');
  }

  const {
    userMakingRequest: { permissions: teamPermissions },
  } = await getTeam({ uuid: folderTeam.uuid, userId });

  // Check permissions
  if (folder.ownerUserId && folder.ownerUserId !== userId) {
    throw new ApiError(403, 'You do not have access to this folder.');
  }

  if (!folder.ownerUserId && !teamPermissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You do not have permission to delete this folder.');
  }

  // Recursively soft-delete the folder, its subfolders, and all files within
  await softDeleteFolderRecursive(folder.id);

  return res.status(200).json({ message: 'Folder deleted.' });
}

/**
 * Recursively soft-delete a folder, its subfolders, and all files within.
 */
async function softDeleteFolderRecursive(folderId: number): Promise<void> {
  const now = new Date();

  // Soft-delete all files in this folder
  await dbClient.file.updateMany({
    where: { folderId, deleted: false },
    data: { deleted: true, deletedDate: now },
  });

  // Soft-delete all scheduled tasks for files in this folder
  const filesInFolder = await dbClient.file.findMany({
    where: { folderId },
    select: { id: true },
  });
  if (filesInFolder.length > 0) {
    await dbClient.scheduledTask.updateMany({
      where: {
        fileId: { in: filesInFolder.map((f) => f.id) },
        status: { not: 'DELETED' },
      },
      data: { status: 'DELETED' },
    });
  }

  // Find all subfolders
  const subfolders = await dbClient.folder.findMany({
    where: { parentFolderId: folderId, deleted: false },
  });

  // Recursively delete subfolders
  for (const subfolder of subfolders) {
    await softDeleteFolderRecursive(subfolder.id);
  }

  // Soft-delete this folder
  await dbClient.folder.update({
    where: { id: folderId },
    data: { deleted: true, deletedDate: now },
  });
}
