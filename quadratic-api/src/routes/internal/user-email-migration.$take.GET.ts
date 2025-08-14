import type { Response } from 'express';
import express from 'express';
import { validationResult } from 'express-validator';
import { z } from 'zod';
import { getUsers } from '../../auth/auth';
import dbClient from '../../dbClient';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import { parseRequest, validateRequestSchema } from '../../middleware/validateRequestSchema';
import type { Request } from '../../types/Request';
import logger from '../../utils/logger';

const router = express.Router();

const schema = z.object({
  params: z.object({
    take: z.coerce.number(),
  }),
});

const requestValidationMiddleware = validateRequestSchema(schema);

router.get(
  '/user-email-migration/:take',
  validateM2MAuth(),
  requestValidationMiddleware,
  async (req: Request, res: Response) => {
    // Validate request parameters
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      params: { take },
    } = parseRequest(req, schema);

    let loop = true;
    let count = 0;
    const seenUsers = new Set<number>();
    const seenEmails = new Set<string>();

    while (loop) {
      const users = await dbClient.user.findMany({
        where: {
          email: null,
        },
        select: {
          id: true,
          auth0Id: true,
        },
        take,
      });
      logger.info(`[user-email-migration] Found ${users.length} users without an email`);

      const newUsers = users.filter((user) => !seenUsers.has(user.id));
      if (newUsers.length === 0) {
        loop = false;
        break;
      }
      newUsers.forEach((user) => seenUsers.add(user.id));

      const usersWithEmail = await getUsers(newUsers);
      logger.info(`[user-email-migration] Found ${Object.values(usersWithEmail).length} auth0 users with an email`);

      const usersWithEmailNonEmpty = Object.values(usersWithEmail).filter((user) => !!user.email);
      logger.info(`[user-email-migration] Found ${usersWithEmailNonEmpty.length} auth0 users with a non-empty email`);

      const usersWithEmailUnique = usersWithEmailNonEmpty.filter((user) => !seenEmails.has(user.email));
      logger.info(`[user-email-migration] Found ${usersWithEmailUnique.length} auth0 users with a unique email`);

      if (usersWithEmailUnique.length === 0) {
        loop = false;
        break;
      }
      usersWithEmailUnique.forEach((user) => seenEmails.add(user.email));

      try {
        await dbClient.$transaction(
          usersWithEmailUnique.map(({ auth0Id, email }) =>
            dbClient.user.update({
              where: { auth0Id },
              data: { email },
            })
          )
        );
        count += usersWithEmailUnique.length;
        logger.info(`[user-email-migration] Migrated ${count} users`);
      } catch (error) {
        logger.error('[user-email-migration] Error:', error);
      }
    }

    return res.status(200).json({ message: `Migration complete for ${count} users` });
  }
);

export default router;
