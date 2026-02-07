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

async function handler(
  req: RequestWithUser,
  res: Response<ApiTypes['/v0/folders/:uuid/delete-preview.GET.response']>
) {
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

  const { files, subfolderCount } = await collectFolderTreeContents(folder.id);

  return res.status(200).json({
    files,
    subfolderCount,
  });
}

/**
 * Recursively collects all files (uuid, name) and counts subfolders in the folder tree.
 */
async function collectFolderTreeContents(
  folderId: number
): Promise<{ files: { uuid: string; name: string }[]; subfolderCount: number }> {
  const filesInFolder = await dbClient.file.findMany({
    where: { folderId, deleted: false },
    select: { uuid: true, name: true },
  });

  const subfolders = await dbClient.folder.findMany({
    where: { parentFolderId: folderId },
    select: { id: true },
  });

  let allFiles = [...filesInFolder];
  let totalSubfolders = subfolders.length;

  for (const subfolder of subfolders) {
    const { files: childFiles, subfolderCount: childCount } = await collectFolderTreeContents(subfolder.id);
    allFiles = allFiles.concat(childFiles);
    totalSubfolders += childCount;
  }

  return {
    files: allFiles.map((f) => ({ uuid: f.uuid, name: f.name })),
    subfolderCount: totalSubfolders,
  };
}
