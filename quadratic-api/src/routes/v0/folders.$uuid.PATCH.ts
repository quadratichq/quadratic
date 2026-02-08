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
import { getAncestorFolderIds, getDescendantFolderIds } from '../../utils/folderTreeQueries';

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
    body: { name, parentFolderUuid, ownerUserId: newOwnerUserId },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req;

  // Get the folder
  const folder = await dbClient.folder.findUnique({
    where: { uuid },
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

  // Check if the user has edit access
  // If the folder is private, only the owner can edit it
  if (folder.ownerUserId && folder.ownerUserId !== userId) {
    throw new ApiError(403, 'You do not have access to this folder.');
  }

  // Team editors and owners can edit public folders
  if (!folder.ownerUserId && !teamPermissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You do not have permission to edit this folder.');
  }

  const data: { name?: string; parentFolderId?: number | null; ownerUserId?: number | null } = {};

  // Update name
  if (name !== undefined) {
    data.name = name;
  }

  // Move to different parent folder
  if (parentFolderUuid !== undefined) {
    if (parentFolderUuid === null) {
      // Move to root
      data.parentFolderId = null;
    } else if (parentFolderUuid === uuid) {
      // Can't move a folder into itself
      throw new ApiError(400, 'Cannot move a folder into itself.');
    }
    // Non-null parent: validation and data.parentFolderId are set inside the transaction (after lock)
  }

  // Change ownership (move between team and private).
  // Moving between Team Files and Private Files requires updating ownerUserId on this folder
  // and recursively on all descendant folders and files; ownerTeamId stays the same (same team).
  if (newOwnerUserId !== undefined) {
    if (!teamPermissions.includes('TEAM_VIEW')) {
      throw new ApiError(403, "You don't have access to this team.");
    }
    if (newOwnerUserId !== null) {
      // Moving to private: must be the requesting user (authorization, not bad request)
      if (newOwnerUserId !== userId) {
        throw new ApiError(403, 'You can only assign folders to your own private files.');
      }
    } else {
      // Moving to team: require TEAM_EDIT so a viewer cannot move their private folder to team files
      if (!teamPermissions.includes('TEAM_EDIT')) {
        throw new ApiError(403, 'You do not have permission to move this folder to team files.');
      }
    }
    data.ownerUserId = newOwnerUserId;

    // When changing ownership, implicitly move to root if no explicit parent was provided.
    // API contract: setting ownerUserId without parentFolderUuid moves the folder to drive root.
    if (parentFolderUuid === undefined) {
      data.parentFolderId = null;
    }
  }

  // Perform the update (and cascade ownership if needed) in a transaction.
  // Circularity and descendants use recursive CTEs to avoid loading all team folders.
  const updatedFolder = await dbClient.$transaction(async (tx) => {
    // Lock the folder row to prevent concurrent modifications while we fetch descendants and cascade.
    await tx.$queryRaw`SELECT id FROM "Folder" WHERE uuid = ${uuid} FOR UPDATE`;

    if (parentFolderUuid !== undefined && parentFolderUuid !== null) {
      const newParent = await tx.folder.findUnique({
        where: { uuid: parentFolderUuid },
      });
      if (!newParent) {
        throw new ApiError(404, 'Target parent folder not found.');
      }
      if (newParent.ownerTeamId !== folder.ownerTeamId) {
        throw new ApiError(400, 'Target parent folder must belong to the same team.');
      }
      if (newParent.ownerUserId && newParent.ownerUserId !== userId) {
        throw new ApiError(403, 'You do not have access to the target parent folder.');
      }
      const ancestorIds = await getAncestorFolderIds(tx, newParent.id);
      if (ancestorIds.includes(folder.id)) {
        throw new ApiError(400, 'Cannot move a folder into one of its subfolders.');
      }
      data.parentFolderId = newParent.id;
    }

    const ownershipActuallyChanging =
      newOwnerUserId !== undefined && newOwnerUserId !== folder.ownerUserId;
    const descendantFolderIds = ownershipActuallyChanging
      ? (await getDescendantFolderIds(tx, folder.id)).filter((id) => id !== folder.id)
      : [];

    const updated = await tx.folder.update({
      where: { uuid },
      data,
      include: { parentFolder: true },
    });

    // Cascade ownerUserId to all descendant folders and to all files in this folder tree.
    // This ensures moving between Team Files and Private Files updates the whole subtree.
    if (newOwnerUserId !== undefined) {
      if (descendantFolderIds.length > 0) {
        await tx.folder.updateMany({
          where: { id: { in: descendantFolderIds } },
          data: { ownerUserId: newOwnerUserId },
        });
      }
      const allFolderIds = [folder.id, ...descendantFolderIds];
      await tx.file.updateMany({
        where: { folderId: { in: allFolderIds }, deleted: false },
        data: { ownerUserId: newOwnerUserId },
      });
    }

    return updated;
  });

  return res.status(200).json({
    folder: {
      uuid: updatedFolder.uuid,
      name: updatedFolder.name,
      parentFolderUuid: updatedFolder.parentFolder?.uuid ?? null,
      ownerUserId: updatedFolder.ownerUserId ?? null,
    },
  });
}
