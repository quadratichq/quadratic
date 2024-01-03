import express, { Request, Response } from 'express';
import { ApiSchemas, ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { getUsersByEmail } from '../../auth0/profile';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/fileMiddleware';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { firstRoleIsHigherThanSecond } from '../../utils/permissions';
const router = express.Router();

const requestValidationMiddleware = validateRequestSchema(
  z.object({
    params: z.object({
      uuid: z.string().uuid(),
    }),
    body: ApiSchemas['/v0/files/:uuid/invites.POST.request'],
  })
);

router.post(
  '/:uuid/invites',
  requestValidationMiddleware,
  validateAccessToken,
  userMiddleware,
  async (req: Request, res: Response) => {
    const {
      body: { email, role },
      params: { uuid },
      user: { id: userId },
    } = req as RequestWithUser;
    const {
      file: { id: fileId },
      user: fileUser,
    } = await getFile({ uuid, userId });

    const userMakingRequestRole = fileUser.role;

    // Can you even invite others?
    if (!fileUser.permissions.includes('FILE_EDIT')) {
      return res.status(403).json({
        error: {
          message: 'You do not have permission to invite others to this file.',
        },
      });
    }

    // Are you trying to invite someone to a role higher than your own? Not so fast!
    if (firstRoleIsHigherThanSecond(role, userMakingRequestRole)) {
      return res.status(403).json({
        error: {
          message: 'You cannot invite someone with a role higher than your own.',
        },
      });
    }

    // Look up the invited user by email in Auth0 and then 1 of 3 things will happen:
    const auth0Users = await getUsersByEmail(email);

    // 1. Nobody with an account by that email, invite them!
    if (auth0Users.length === 0) {
      // TODO: where do we remove them from this table once they become a user?
      // TODO: write tests for this

      // See if this email already exists as an invite on the file and invite them
      const dbInvite = await dbClient.fileInvite.upsert({
        where: {
          email_fileId: {
            email,
            fileId,
          },
        },
        create: {
          email,
          role,
          fileId,
        },
        update: {
          role,
        },
      });

      // TODO: send the invited person an email

      return res.status(201).json({ email, role, id: dbInvite.id });
    }

    // 2. Somebody with that email already has an account, add them!
    if (auth0Users.length === 1) {
      const auth0User = auth0Users[0];

      // Auth0 says this could be undefined. If that's the case (even though,
      // we found a user) we'll throw an error
      if (!auth0User.user_id) {
        return res
          .status(500)
          .json({ error: { message: 'Internal server error: user found but expected `user_id` is not present' } });
      }

      // Lookup the user in our database (create if they don't exist)
      const dbUser = await dbClient.user.upsert({
        where: {
          auth0_id: auth0User.user_id,
        },
        create: {
          auth0_id: auth0User.user_id,
        },
        update: {},
      });

      // See if they're already a member
      const u = await dbClient.userFileRole.findUnique({
        where: {
          userId_fileId: {
            userId: dbUser.id,
            fileId,
          },
        },
      });
      if (u !== null) {
        return res.status(400).json({
          error: { message: 'User is already a member of this file' },
        });
      }

      // If not, add them!
      await dbClient.userFileRole.create({
        data: {
          userId: dbUser.id,
          fileId,
          role,
        },
      });

      // TODO: send them an email

      const data: ApiTypes['/v0/teams/:uuid/invites.POST.response'] = { email, role, id: dbUser.id };
      return res.status(201).json(data);
    }

    // 3. Duplicate email
    // TODO:, how should we handle this?
    // TODO: don't allow people to create multiple accounts with one email in auth0
    // TODO: talk to David K.
    return res.status(500).json({ error: { message: 'Internal server error: duplicate email' } });
  }
);

export default router;
