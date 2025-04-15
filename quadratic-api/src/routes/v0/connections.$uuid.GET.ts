import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getConnection } from '../../middleware/getConnection';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { decryptFromEnv, generateSshKeys } from '../../utils/crypto';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({ uuid: z.string().uuid() }),
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/connections/:uuid.GET.response']>) {
  const {
    user: { id: userId },
  } = req;
  const {
    params: { uuid },
  } = parseRequest(req, schema);
  let {
    connection,
    team: {
      userMakingRequest: { permissions: teamPermissions },
    },
    team: {
      team: { sshPublicKey, sshPrivateKey, id: teamId },
    },
  } = await getConnection({ uuid, userId });

  // Do you have permission?
  if (!teamPermissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You do not have permission to view this connection');
  }

  // generate SSH keys if they don't exist and update the team
  if (sshPublicKey === null || sshPrivateKey === null) {
    const { privateKey, publicKey } = await generateSshKeys();
    await dbClient.team.update({
      where: { id: teamId },
      data: { sshPublicKey: publicKey, sshPrivateKey: privateKey },
    });

    sshPublicKey = publicKey;
    sshPrivateKey = privateKey;
  }

  const typeDetails = JSON.parse(decryptFromEnv(connection.typeDetails.toString()));
  typeDetails.sshKey = sshPublicKey ? Buffer.from(sshPublicKey).toString('base64') : undefined;

  return res.status(200).json({
    uuid: connection.uuid,
    name: connection.name,
    type: connection.type,
    createdDate: connection.createdDate.toISOString(),
    updatedDate: connection.updatedDate.toISOString(),
    typeDetails,
  });
}
