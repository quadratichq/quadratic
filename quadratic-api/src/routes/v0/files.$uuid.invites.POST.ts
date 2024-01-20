import * as Sentry from '@sentry/node';
import { Request, Response } from 'express';
import { ApiSchemas, ApiTypes, FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { getUsersFromAuth0, lookupUsersFromAuth0ByEmail } from '../../auth0/profile';
import dbClient from '../../dbClient';
import { sendEmail } from '../../email/sendEmail';
import { templates } from '../../email/templates';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
const { FILE_EDIT } = FilePermissionSchema.enum;

export default [
  validateRequestSchema(
    z.object({
      params: z.object({
        uuid: z.string().uuid(),
      }),
      body: ApiSchemas['/v0/files/:uuid/invites.POST.request'],
    })
  ),
  validateAccessToken,
  userMiddleware,
  handler,
];

async function handler(req: Request, res: Response<ApiTypes['/v0/files/:uuid/invites.POST.response']>) {
  const {
    body,
    params: { uuid },
    user: { id: userId, auth0Id: userAuth0Id },
  } = req as RequestWithUser;
  const { email, role } = body as ApiTypes['/v0/files/:uuid/invites.POST.request'];
  const {
    file: { id: fileId, name: fileName },
    userMakingRequest,
  } = await getFile({ uuid, userId });

  // Can you even invite others?
  if (!userMakingRequest.filePermissions.includes(FILE_EDIT)) {
    throw new ApiError(403, 'You do not have permission to invite others to this file.');
  }

  // Are you trying to create an invite that already exists?
  const existingInvite = await dbClient.fileInvite.findUnique({
    where: {
      email_fileId: {
        email,
        fileId,
      },
    },
  });
  if (existingInvite) {
    throw new ApiError(409, 'An invite with this email already exists.');
  }

  // Get the current user's email/name and other info for sending email
  const resultsById = await getUsersFromAuth0([{ id: userId, auth0Id: userAuth0Id }]);
  const { email: senderEmail, name: senderName } = resultsById[userId];
  const emailTemplateArgs = {
    senderName,
    senderEmail,
    fileName,
    fileRole: role,
    fileUuid: uuid,
    origin: String(req.headers.origin),
  };

  // Look up the invited user by email in Auth0 and then 1 of 3 things will happen:
  const auth0Users = await lookupUsersFromAuth0ByEmail(email);

  // 1. Nobody with an account by that email, so create one and send an invite
  if (auth0Users.length === 0) {
    const dbInvite = await dbClient.fileInvite.create({
      data: {
        email,
        role,
        fileId,
      },
    });
    await sendEmail(email, templates.inviteToFile(emailTemplateArgs));
    return res.status(201).json({ email, role, id: dbInvite.id });
  }

  // 2. Somebody with that email already has an account, so add them to the file
  if (auth0Users.length === 1) {
    const { user_id: auth0Id } = auth0Users[0];

    // Auth0 says this could be undefined. If that's the case (even though,
    // we found a user) we'll throw an error
    if (!auth0Id) {
      throw new ApiError(500, 'Internal server error: user found but expected `user_id` is not present');
    }

    // Lookup the user in our database
    const dbUser = await dbClient.user.findUnique({
      where: {
        auth0Id,
      },
      include: {
        UserFileRole: {
          where: {
            fileId,
          },
        },
      },
    });

    // If they don't exist in our database, but they do in auth0, that's strange
    // They need to go through the flow of coming into the app for the first time
    // So we'll throw
    if (!dbUser) {
      throw new ApiError(400, 'User needs to sign in to the app before making changes to this file.');
      Sentry.captureEvent({
        message: 'User exists in Auth0 but not in the database and tried to make a change.',
        level: 'warning',
        extra: {
          auth0Id,
        },
      });
    }

    // Are they already a member of this file?
    if (dbUser.UserFileRole.length) {
      throw new ApiError(409, 'User is already a member of this file');
    }

    // Ok let's, add ‘em and send an email
    const userFileRole = await dbClient.userFileRole.create({
      data: {
        userId: dbUser.id,
        fileId,
        role,
      },
    });
    await sendEmail(email, templates.inviteToFile(emailTemplateArgs));

    return res.status(201).json({ id: userFileRole.id, role, userId: userFileRole.userId });
  }

  // 3. Duplicate emails in Auth0
  // This is unexpected. If it happens, we throw and log to Sentry
  throw new ApiError(500, 'Internal server error: duplicate emails');
  Sentry.captureEvent({
    message: 'Duplicate emails in Auth0',
    level: 'error',
    extra: {
      auth0Users,
    },
  });
}
