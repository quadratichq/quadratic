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
  body: ApiSchemas['/v0/folders.POST.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/folders.POST.response']>) {
  const {
    body: { name, teamUuid, parentFolderUuid, isPrivate },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req;

  // Check that the team exists and the user has access
  const {
    team,
    userMakingRequest: { permissions: teamPermissions },
  } = await getTeam({ uuid: teamUuid, userId });

  const canView = teamPermissions.includes('TEAM_VIEW');
  const canEdit = teamPermissions.includes('TEAM_EDIT');

  if (!(canView || canEdit)) {
    throw new ApiError(403, 'User does not have permission to create a folder in this team.');
  }

  // If they can only view the team, they can only create private folders
  if (!canEdit && !isPrivate) {
    throw new ApiError(403, 'User does not have permission to create a public folder in this team.');
  }

  // If a parent folder is specified, validate it exists and belongs to the same team
  let parentFolderId: number | undefined;
  if (parentFolderUuid) {
    const parentFolder = await dbClient.folder.findUnique({
      where: { uuid: parentFolderUuid },
    });
    if (!parentFolder) {
      throw new ApiError(404, 'Parent folder not found.');
    }
    if (parentFolder.ownerTeamId !== team.id) {
      throw new ApiError(400, 'Parent folder must belong to the same team.');
    }
    // Ensure subfolder privacy matches parent: private under private (same user), team under team
    if (isPrivate) {
      if (parentFolder.ownerUserId === null) {
        throw new ApiError(
          400,
          'A private subfolder must be created under a private folder owned by you.',
        );
      }
      if (parentFolder.ownerUserId !== userId) {
        throw new ApiError(
          400,
          'A private subfolder must be created under a private folder you own.',
        );
      }
    } else {
      if (parentFolder.ownerUserId !== null) {
        throw new ApiError(
          400,
          'A team folder must be created under a team folder, not a private folder.',
        );
      }
    }
    parentFolderId = parentFolder.id;
  }

  const folder = await dbClient.folder.create({
    data: {
      name,
      ownerTeamId: team.id,
      ownerUserId: isPrivate ? userId : undefined,
      parentFolderId: parentFolderId ?? null,
    },
  });

  return res.status(201).json({
    folder: {
      uuid: folder.uuid,
      name: folder.name,
      parentFolderUuid: parentFolderUuid ?? null,
      ownerUserId: folder.ownerUserId ?? null,
    },
  });
}
