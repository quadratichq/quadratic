import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas, FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import type { ResponseError } from '../../types/Response';
import { ApiError } from '../../utils/ApiError';
const { FILE_EDIT, FILE_MOVE } = FilePermissionSchema.enum;

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
  body: ApiSchemas['/v0/files/:uuid.PATCH.request'],
});

async function handler(
  req: RequestWithUser,
  res: Response<ApiTypes['/v0/files/:uuid.PATCH.response'] | ResponseError>
) {
  const {
    params: { uuid },
    body: { name, ownerUserId, timezone, folderUuid },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req;
  const {
    file,
    userMakingRequest: { filePermissions, teamPermissions, id: userMakingRequestId },
  } = await getFile({ uuid, userId });

  // Can't change multiple things at once, except move-to-root + ownership in one call (for drag-drop)
  const fieldsToUpdate = [name, ownerUserId, timezone, folderUuid].filter((field) => field !== undefined);
  const isMoveToRootWithOwnership =
    folderUuid !== undefined && ownerUserId !== undefined && folderUuid === null && fieldsToUpdate.length === 2;
  if (fieldsToUpdate.length > 1 && !isMoveToRootWithOwnership) {
    return res.status(400).json({ error: { message: 'You can only change one thing at a time' } });
  }

  // Can they edit this file?
  if (!filePermissions.includes(FILE_EDIT)) {
    return res.status(403).json({ error: { message: 'Permission denied' } });
  }

  //
  // Updating the name?
  //
  if (name !== undefined) {
    const { name: newName } = await dbClient.file.update({
      where: {
        uuid,
      },
      data: {
        name,
      },
    });
    return res.status(200).json({ name: newName });
  }

  //
  // Updating the timezone?
  //
  if (timezone !== undefined) {
    const { timezone: newTimezone } = await dbClient.file.update({
      where: {
        uuid,
      },
      data: {
        timezone,
      },
    });
    return res.status(200).json({ timezone: newTimezone ?? null });
  }

  //
  // Moving the file?
  //

  // Do you have permission to move? (You can't move someone else's private file, for example)
  if (!filePermissions.includes(FILE_MOVE)) {
    throw new ApiError(403, 'Permission denied');
  }

  type MoveDb = Pick<typeof dbClient, 'file' | 'folder' | '$queryRaw'>;

  const executeMove = async (
    db: MoveDb
  ): Promise<ApiTypes['/v0/files/:uuid.PATCH.response'] | null> => {
    // Move to root and set ownership in one call (e.g. drag file to "Private Files" or "Team Files")
    if (isMoveToRootWithOwnership) {
      if (!filePermissions.includes(FILE_EDIT)) {
        throw new ApiError(403, 'Permission denied');
      }
      if (ownerUserId !== null && ownerUserId !== userMakingRequestId) {
        throw new ApiError(400, 'You can only move your own files');
      }
      await db.file.update({
        where: { uuid },
        data: { folderId: null, ownerUserId: ownerUserId ?? null },
      });
      return {
        folderUuid: null,
        ownerUserId: ownerUserId ?? undefined,
      };
    }

    // Moving to a user's private (team) files?
    if (ownerUserId) {
      if (ownerUserId !== userMakingRequestId) {
        throw new ApiError(400, 'You can only move your own files');
      }
      const modifiedFile = await db.file.update({
        where: { uuid },
        data: { ownerUserId },
      });
      if (!modifiedFile.ownerUserId) {
        throw new ApiError(500, 'Failed to move file. Make sure the specified file and user exist.');
      }
      return { ownerUserId: modifiedFile.ownerUserId };
    }

    // Moving to a team's public files?
    if (ownerUserId === null) {
      const modifiedFile = await db.file.update({
        where: { uuid },
        data: { ownerUserId: null },
      });
      if (modifiedFile.ownerUserId !== null) {
        throw new ApiError(500, 'Failed to move file. Make sure the specified team and user exist.');
      }
      return { ownerUserId: undefined };
    }

    // Moving to a folder?
    if (folderUuid !== undefined) {
      let folderId: number | null = null;
      let adjustedOwnerUserId: number | null | undefined = undefined;

      if (folderUuid !== null) {
        const folder = await db.folder.findUnique({
          where: { uuid: folderUuid },
        });
        if (!folder) {
          throw new ApiError(404, 'Folder not found.');
        }
        if (folder.ownerTeamId !== file.ownerTeamId) {
          throw new ApiError(400, 'Folder must belong to the same team as the file.');
        }
        if (folder.ownerUserId && folder.ownerUserId !== userId) {
          throw new ApiError(403, 'You do not have access to the target folder.');
        }
        folderId = folder.id;
        const folderOwner = folder.ownerUserId ?? null;
        const fileOwner = file.ownerUserId ?? null;
        if (folderOwner !== fileOwner) {
          adjustedOwnerUserId = folderOwner;
        }
      }

      const data: { folderId: number | null; ownerUserId?: number | null } = { folderId };
      if (adjustedOwnerUserId !== undefined) {
        data.ownerUserId = adjustedOwnerUserId;
      }

      await db.file.update({
        where: { uuid },
        data,
      });

      return {
        folderUuid: folderUuid,
        ownerUserId: adjustedOwnerUserId !== undefined ? (adjustedOwnerUserId ?? undefined) : undefined,
      };
    }

    return null;
  };

  // If the file is in a folder, lock the folder row and verify access inside a transaction
  // so another request cannot change the folder's owner between the check and the update.
  if (file.folderId !== null) {
    const currentFolderId = file.folderId;
    const result = await dbClient.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Folder" WHERE id = ${currentFolderId} FOR UPDATE`;
      const currentFolder = await tx.folder.findUnique({
        where: { id: currentFolderId },
      });
      if (currentFolder) {
        if (currentFolder.ownerUserId !== null && currentFolder.ownerUserId !== userId) {
          throw new ApiError(403, 'You do not have access to the current folder.');
        }
        if (currentFolder.ownerUserId === null && !teamPermissions?.includes('TEAM_EDIT')) {
          throw new ApiError(403, 'You do not have access to the current folder.');
        }
      }
      return executeMove(tx);
    });
    if (result) {
      return res.status(200).json(result);
    }
  } else {
    const result = await executeMove(dbClient);
    if (result) {
      return res.status(200).json(result);
    }
  }

  // We don't know what you're asking for
  return res.status(400).json({ error: { message: 'Invalid request' } });
}
