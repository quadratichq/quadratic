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
    } else {
      // Can't move a folder into itself
      if (parentFolderUuid === uuid) {
        throw new ApiError(400, 'Cannot move a folder into itself.');
      }

      const newParent = await dbClient.folder.findUnique({
        where: { uuid: parentFolderUuid },
      });

      if (!newParent) {
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

  // Change ownership (move between team and private)
  if (newOwnerUserId !== undefined) {
    if (newOwnerUserId !== null) {
      // Moving to private: must be the requesting user
      if (newOwnerUserId !== userId) {
        throw new ApiError(400, 'You can only move folders to your own private files.');
      }
    }
    data.ownerUserId = newOwnerUserId;

    // When changing ownership, move to root if no explicit parent was provided
    if (parentFolderUuid === undefined) {
      data.parentFolderId = null;
    }
  }

  // Collect descendant folder IDs before updating (needed for cascading ownership)
  let descendantFolderIds: number[] = [];
  if (newOwnerUserId !== undefined) {
    descendantFolderIds = await collectDescendantFolderIds(folder.id);
  }

  // Perform the update (and cascade ownership if needed) in a transaction
  const updatedFolder = await dbClient.$transaction(async (tx) => {
    const updated = await tx.folder.update({
      where: { uuid },
      data,
      include: { parentFolder: true },
    });

    // Cascade ownership change to all descendant folders and their files
    if (newOwnerUserId !== undefined) {
      if (descendantFolderIds.length > 0) {
        await tx.folder.updateMany({
          where: { id: { in: descendantFolderIds } },
          data: { ownerUserId: newOwnerUserId },
        });
      }
      // Update all files in this folder and its descendants to match the new ownership
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

/**
 * Recursively collects all descendant folder IDs for a given folder.
 * Used to cascade ownership changes to the entire subtree.
 */
async function collectDescendantFolderIds(folderId: number): Promise<number[]> {
  const children = await dbClient.folder.findMany({
    where: { parentFolderId: folderId },
    select: { id: true },
  });

  const ids = children.map((c) => c.id);
  for (const child of children) {
    ids.push(...(await collectDescendantFolderIds(child.id)));
  }
  return ids;
}
