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

  // Soft-delete all files in the tree and hard-delete folders in one transaction (batched for performance)
  await dbClient.$transaction(async (tx) => {
    const teamFolders = await tx.folder.findMany({
      where: { ownerTeamId: folder.ownerTeamId },
      select: { id: true, parentFolderId: true },
    });
    const descendantIdsWithDepth = getDescendantIdsWithDepth(folder.id, teamFolders);
    const folderIds = descendantIdsWithDepth.map(({ id }) => id);
    const now = new Date();

    if (folderIds.length > 0) {
      // We soft-delete files first so they can be restored. The migration uses ON DELETE SET NULL
      // on File.folder_id as a safety net if a folder is ever deleted without going through this path.
      await tx.file.updateMany({
        where: { folderId: { in: folderIds }, deleted: false },
        data: { deleted: true, deletedDate: now },
      });

      const filesInTree = await tx.file.findMany({
        where: { folderId: { in: folderIds } },
        select: { id: true },
      });
      const fileIds = filesInTree.map((f) => f.id);
      if (fileIds.length > 0) {
        await tx.scheduledTask.updateMany({
          where: { fileId: { in: fileIds }, status: { not: 'DELETED' } },
          data: { status: 'DELETED' },
        });
      }
    }

    // Delete folders in depth-descending order (children before parents)
    const sortedByDepthDesc = [...descendantIdsWithDepth].sort((a, b) => b.depth - a.depth);
    for (const { id } of sortedByDepthDesc) {
      await tx.folder.delete({ where: { id } });
    }
  });

  return res.status(200).json({ message: 'Folder deleted.' });
}

/**
 * Returns all descendant folder IDs (including the given root) with depth (0 = root).
 */
function getDescendantIdsWithDepth(
  rootId: number,
  teamFolders: { id: number; parentFolderId: number | null }[]
): { id: number; depth: number }[] {
  const childrenByParentId = new Map<number, number[]>();
  for (const f of teamFolders) {
    if (f.parentFolderId === null) continue;
    const p = f.parentFolderId;
    if (!childrenByParentId.has(p)) childrenByParentId.set(p, []);
    childrenByParentId.get(p)!.push(f.id);
  }
  const result: { id: number; depth: number }[] = [];
  const queue: { id: number; depth: number }[] = [{ id: rootId, depth: 0 }];
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    result.push({ id, depth });
    const children = childrenByParentId.get(id) ?? [];
    for (const c of children) {
      queue.push({ id: c, depth: depth + 1 });
    }
  }
  return result;
}
