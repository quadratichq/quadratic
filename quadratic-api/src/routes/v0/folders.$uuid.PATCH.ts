import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
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
  body: ApiSchemas['/v0/folders/:uuid.PATCH.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/folders/:uuid.PATCH.response']>) {
  const {
    params: { uuid },
    body: { name, parentFolderUuid },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req;

  // Get the folder
  const folder = await dbClient.folder.findUnique({
    where: { uuid },
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

  // Check if the user has edit access
  // If the folder is private, only the owner can edit it
  if (folder.ownerUserId && folder.ownerUserId !== userId) {
    throw new ApiError(403, 'You do not have access to this folder.');
  }

  // Team editors and owners can edit public folders
  if (!folder.ownerUserId && !teamPermissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You do not have permission to edit this folder.');
  }

  const data: { name?: string; parentFolderId?: number | null; updatedDate: Date } = {
    updatedDate: new Date(),
  };

  // Update name
  if (name !== undefined) {
    data.name = name;
  }

  // Move to different parent folder
  if (parentFolderUuid !== undefined) {
    if (parentFolderUuid === null) {
      // Move to root
      data.parentFolderId = null;
    } else {
      // Can't move a folder into itself
      if (parentFolderUuid === uuid) {
        throw new ApiError(400, 'Cannot move a folder into itself.');
      }

      const newParent = await dbClient.folder.findUnique({
        where: { uuid: parentFolderUuid },
      });

      if (!newParent || newParent.deleted) {
        throw new ApiError(404, 'Target parent folder not found.');
      }

      if (newParent.ownerTeamId !== folder.ownerTeamId) {
        throw new ApiError(400, 'Target parent folder must belong to the same team.');
      }

      // Check for circular reference: walk up from the new parent to make sure
      // we don't encounter the folder being moved
      let current = newParent;
      while (current.parentFolderId) {
        if (current.parentFolderId === folder.id) {
          throw new ApiError(400, 'Cannot move a folder into one of its subfolders.');
        }
        const parent = await dbClient.folder.findUnique({
          where: { id: current.parentFolderId },
        });
        if (!parent) break;
        current = parent;
      }

      data.parentFolderId = newParent.id;
    }
  }

  const updatedFolder = await dbClient.folder.update({
    where: { uuid },
    data,
    include: { parentFolder: true },
  });

  return res.status(200).json({
    folder: {
      uuid: updatedFolder.uuid,
      name: updatedFolder.name,
      createdDate: updatedFolder.createdDate.toISOString(),
      updatedDate: updatedFolder.updatedDate.toISOString(),
      parentFolderUuid: updatedFolder.parentFolder?.uuid ?? null,
      ownerUserId: updatedFolder.ownerUserId ?? null,
    },
  });
}
