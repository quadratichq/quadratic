import axios from 'axios';
import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { createFile } from '../../utils/createFile';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/examples.POST.request'],
});

// Takes the URL of a file in production and, if publicly available, duplicates
// it to the requesting user's account.
async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/examples.POST.response']>) {
  const { id: userId } = req.user;
  const {
    body: { publicFileUrlInProduction, teamUuid, isPrivate },
  } = parseRequest(req, schema);
  const {
    team,
    userMakingRequest: { permissions: teamPermissions },
  } = await getTeam({ uuid: teamUuid, userId });

  const jwt = req.header('Authorization');

  if (!jwt) {
    throw new ApiError(403, 'User does not have a valid JWT.');
  }

  // We validate that we get a UUID in the zod schema, so if we reach here
  // we know we can do this simple operation.
  const fileUuid = publicFileUrlInProduction.split('/').pop() as string;

  // Make sure the user has the ability to create a file in the given team
  if (!teamPermissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You do not have permission to create a file in this team.');
  }

  try {
    const apiUrl = `https://api-aws.quadratichq.com/v0/files/${fileUuid}`;

    // Fetch info about the file
    const {
      file: { name, lastCheckpointDataUrl, lastCheckpointVersion },
    } = (await axios.get(apiUrl).then((res) => res.data)) as ApiTypes['/v0/files/:uuid.GET.response'];

    // Fetch the contents of the file
    const fileContents = await axios
      .get(lastCheckpointDataUrl, { responseType: 'arraybuffer' })
      .then((res) => res.data);
    const buffer = new Uint8Array(fileContents);

    // Create a private file for the user in the requested team
    const dbFile = await createFile({
      name,
      userId,
      contents: Buffer.from(new Uint8Array(buffer)).toString('base64'),
      version: lastCheckpointVersion,
      teamId: team.id,
      isPrivate,
      jwt,
    });
    return res.status(201).json({ uuid: dbFile.uuid, name: dbFile.name });
  } catch (error) {
    console.error(JSON.stringify({ message: 'Error in examples.POST handler', error }));
    throw new ApiError(500, 'Failed to fetch example file. Ensure the file exists and is publicly accessible.');
  }
}
