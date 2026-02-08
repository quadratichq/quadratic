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

      // User must have access to the target parent (e.g. cannot move into another user's private folder)
      if (newParent.ownerUserId && newParent.ownerUserId !== userId) {
        throw new ApiError(403, 'You do not have access to the target parent folder.');
      }

      data.parentFolderId = newParent.id;
    }
  }

  // Change ownership (move between team and private).
  // Moving between Team Files and Private Files requires updating ownerUserId on this folder
  // and recursively on all descendant folders and files; ownerTeamId stays the same (same team).
  if (newOwnerUserId !== undefined) {
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
  // Circularity check and descendant collection run inside the transaction for consistency.
  const updatedFolder = await dbClient.$transaction(async (tx) => {
    // Load all team folders once and check circularity in memory (avoid N+1)
    const teamFolders = await tx.folder.findMany({
      where: { ownerTeamId: folder.ownerTeamId },
      select: { id: true, uuid: true, parentFolderId: true },
    });
    const folderById = new Map(teamFolders.map((f) => [f.id, f]));

    if (parentFolderUuid !== undefined && parentFolderUuid !== null) {
      const newParentInTx = teamFolders.find((f) => f.uuid === parentFolderUuid);
      if (newParentInTx) {
        let currentId: number | null = newParentInTx.id;
        while (currentId !== null) {
          const node = folderById.get(currentId);
          if (!node) break;
          if (node.parentFolderId === folder.id) {
            throw new ApiError(400, 'Cannot move a folder into one of its subfolders.');
          }
          currentId = node.parentFolderId;
        }
      }
    }

    // Collect descendant folder IDs inside transaction so list cannot go stale
    let descendantFolderIds: number[] = [];
    if (newOwnerUserId !== undefined) {
      descendantFolderIds = await collectDescendantFolderIds(folder.id, tx);
    }

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

type TransactionClient = Parameters<Parameters<typeof dbClient.$transaction>[0]>[0];

/**
 * Recursively collects all descendant folder IDs for a given folder.
 * Used to cascade ownership changes to the entire subtree.
 */
async function collectDescendantFolderIds(folderId: number, tx: TransactionClient): Promise<number[]> {
  const children = await tx.folder.findMany({
    where: { parentFolderId: folderId },
    select: { id: true },
  });

  const ids = children.map((c) => c.id);
  for (const child of children) {
    ids.push(...(await collectDescendantFolderIds(child.id, tx)));
  }
  return ids;
}
