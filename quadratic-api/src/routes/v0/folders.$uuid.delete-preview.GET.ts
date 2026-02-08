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

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/folders/:uuid/delete-preview.GET.response']>) {
  const {
    user: { id: userId },
  } = req;
  const folderUuid = req.params.uuid;

  const folder = await dbClient.folder.findUnique({
    where: { uuid: folderUuid },
  });

  if (!folder) {
    throw new ApiError(404, 'Folder not found.');
  }

  const folderTeam = await dbClient.team.findUnique({ where: { id: folder.ownerTeamId } });
  if (!folderTeam) {
    throw new ApiError(404, 'Team not found.');
  }

  const {
    userMakingRequest: { permissions: teamPermissions },
  } = await getTeam({ uuid: folderTeam.uuid, userId });

  if (folder.ownerUserId && folder.ownerUserId !== userId) {
    throw new ApiError(403, 'You do not have access to this folder.');
  }

  if (!folder.ownerUserId && !teamPermissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You do not have permission to delete this folder.');
  }

  const { files, subfolderCount } = await getFolderTreeContentsBulk(folder.id, folder.ownerTeamId);

  return res.status(200).json({
    files,
    subfolderCount,
  });
}

/**
 * Collects all files and subfolder count in the folder tree using one folder query and one file query.
 */
async function getFolderTreeContentsBulk(
  folderId: number,
  ownerTeamId: number
): Promise<{ files: { uuid: string; name: string }[]; subfolderCount: number }> {
  const teamFolders = await dbClient.folder.findMany({
    where: { ownerTeamId },
    select: { id: true, parentFolderId: true },
  });
  const folderById = new Map(teamFolders.map((f) => [f.id, f]));

  const descendantIds = new Set<number>();
  const stack = [folderId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    descendantIds.add(id);
    for (const f of teamFolders) {
      if (f.parentFolderId === id) stack.push(f.id);
    }
  }

  const subfolderCount = descendantIds.size - 1;
  const files = await dbClient.file.findMany({
    where: { folderId: { in: [...descendantIds] }, deleted: false },
    select: { uuid: true, name: true },
  });

  return {
    files: files.map((f) => ({ uuid: f.uuid, name: f.name })),
    subfolderCount,
  };
}
