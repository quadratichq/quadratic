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
import { createFile } from '../../utils/createFile';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/files.POST.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/files.POST.response']>) {
  const {
    body: { name, contents, version, teamUuid, isPrivate, folderUuid },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req;

  const jwt = req.header('Authorization');

  if (!jwt) {
    throw new ApiError(403, 'User does not have a valid JWT.');
  }

  // Check that the team exists and the user can create in it
  const {
    team,
    userMakingRequest: { permissions: teamPermissions },
  } = await getTeam({ uuid: teamUuid, userId });

  const teamId = team.id;

  // Note: We no longer block file creation when over the limit.
  // Instead, files beyond the limit will become read-only (soft limit).
  // The client checks the limit beforehand and shows a confirmation dialog.

  const canView = teamPermissions.includes('TEAM_VIEW');
  const canEdit = teamPermissions.includes('TEAM_EDIT');

  // Can they view OR edit the team?
  if (!(canView || canEdit)) {
    throw new ApiError(403, 'User does not have permission to create a file in this team.');
  }

  // If they can only view the team, are they trying to create a public file?
  if (!canEdit && !isPrivate) {
    throw new ApiError(403, 'User does not have permission to create a public file in this team.');
  }

  // If a folder is specified, validate it exists and belongs to the same team
  let folderId: number | undefined;
  if (folderUuid) {
    const folder = await dbClient.folder.findUnique({
      where: { uuid: folderUuid },
    });
    if (!folder) {
      throw new ApiError(404, 'Folder not found.');
    }
    if (folder.ownerTeamId !== teamId) {
      throw new ApiError(400, 'Folder must belong to the same team.');
    }
    folderId = folder.id;
  }

  // Ok, create it!
  const dbFile = await createFile({ name, userId, teamId, contents, version, isPrivate, jwt, folderId });
  return res.status(201).json({
    file: { uuid: dbFile.uuid, name: dbFile.name },
    team: {
      uuid: (dbFile.ownerTeam as any).uuid,
    },
  });
}
