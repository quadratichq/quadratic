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
import { getDescendantFolderIds } from '../../utils/folderTreeQueries';

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

  if (!folder) {
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

  // Reject very large trees to avoid long-running transactions, lock contention, and timeouts
  const MAX_FOLDERS_IN_DELETE = 500;
  const descendantFolderIds = await getDescendantFolderIds(dbClient, folder.id);
  if (descendantFolderIds.length > MAX_FOLDERS_IN_DELETE) {
    throw new ApiError(
      413,
      `This folder tree is too large to delete at once (${descendantFolderIds.length} folders). Please delete subfolders in smaller batches.`
    );
  }

  // Soft-delete files and scheduled tasks first, then hard-delete folders. Order matters: we must
  // update files before deleting folders so (1) files can be restored and (2) FK ON DELETE SET NULL
  // on File.folder_id only runs as a safety net, not while files still reference the folders.
  await dbClient.$transaction(async (tx) => {
    const folderIds = await getDescendantFolderIds(tx, folder.id);
    const now = new Date();

    if (folderIds.length > 0) {
      await tx.file.updateMany({
        where: { folderId: { in: folderIds }, deleted: false },
        data: { deleted: true, deletedDate: now },
      });

      await tx.scheduledTask.updateMany({
        where: {
          file: { folderId: { in: folderIds } },
          status: { not: 'DELETED' },
        },
        data: { status: 'DELETED' },
      });
    }

    await tx.folder.deleteMany({
      where: { id: { in: folderIds } },
    });
  });

  return res.status(200).json({ message: 'Folder deleted.' });
}
