import express from 'express';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { Request } from '../../types/Request';
import { GetSecret } from './awsSecret';
import { PostgresConnection } from './types/Postgres';

const router = express.Router();

const Schema = z.object({
  query: z.string(),
});

router.post(
  '/:uuid/run',
  validateAccessToken,
  userMiddleware,
  // TODO validate connection
  //   validateRequestAgainstZodSchema(Schema),
  async (req: Request, res) => {
    if (!req.user) {
      return res.status(500).json({ error: { message: 'Internal server error' } });
    }
    console.log('request.params', req.params);

    const connection = await dbClient.connection.findUnique({
      where: {
        uuid: req.params.uuid,
      },
    });

    const connection_secret = await GetSecret(connection.secretArn);

    // TODO: run query
    console.log(connection);
    console.log(connection_secret);

    const connection_key = JSON.parse(connection_secret.SecretString);

    console.log('connection_key', connection_key);

    const result = await new PostgresConnection().runConnection(connection_key, req.body.query);

    console.log('query response', result);

    return res.status(200).json({
      result,
    });
  }
);

export default router;
