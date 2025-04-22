import { Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { generateSshKeys } from '../../utils/crypto';
export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/teams/:uuid/ssh-public-key.GET.response']>) {
  const {
    user: { id: userId },
  } = req;
  const {
    params: { uuid: teamUuid },
  } = parseRequest(req, schema);

  let {
    team: { sshPublicKey, id: teamId },
    userMakingRequest: { permissions },
  } = await getTeam({ uuid: teamUuid, userId });

  // Do you have permission?
  if (!permissions.includes('TEAM_VIEW')) {
    throw new ApiError(403, 'You don’t have access to this team');
  }

  // generate SSH keys if they don't exist and update the team
  if (sshPublicKey === null) {
    const { privateKey, publicKey } = await generateSshKeys();
    await dbClient.team.update({
      where: { id: teamId },
      data: { sshPublicKey: publicKey, sshPrivateKey: privateKey },
    });

    sshPublicKey = publicKey;
  }

  // Pick out the data we want to return
  const data = {
    sshPublicKey: Buffer.from(sshPublicKey).toString('base64'),
  };

  return res.status(200).json(data);
}
