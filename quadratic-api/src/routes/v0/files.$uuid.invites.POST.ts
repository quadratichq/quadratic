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
    user: { id: userMakingRequestId, auth0Id: userMakingRequestAuth0Id },
  } = req as RequestWithUser;
  const { email, role } = body as ApiTypes['/v0/files/:uuid/invites.POST.request'];
  const {
    file: { id: fileId, name: fileName },
    userMakingRequest: { filePermissions },
  } = await getFile({ uuid, userId: userMakingRequestId });

  // Can you even invite others?
  if (!filePermissions.includes(FILE_EDIT)) {
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
  const resultsById = await getUsersFromAuth0([{ id: userMakingRequestId, auth0Id: userMakingRequestAuth0Id }]);
  const { email: senderEmail, name: senderName } = resultsById[userMakingRequestId];
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

  // 1.
  // If there’s 3 or more users, that's unexpected. We'll throw.
  if (auth0Users.length >= 3) {
    throw new ApiError(500, 'Internal server error: user lookup error.');
    Sentry.captureEvent({
      message: 'User has 3 or more accounts in auth0 with the same email.',
      level: 'error',
      extra: {
        auth0Users,
      },
    });
  }

  // 2.
  // If there are 0 users, somebody who doesn't have a Quadratic account is
  // being invited. So we create an invite and send an email.
  if (auth0Users.length === 0) {
    const dbInvite = await dbClient.fileInvite.create({
      data: {
        email,
        role,
        fileId,
      },
    });
    await sendEmail(email, templates.inviteToFile(emailTemplateArgs));
    return res.status(201).json([{ email, role, id: dbInvite.id }]);
  }

  // 3.
  // There are are 1 or 2 user(s), we will associate each as a user of the file
  // and send them an email. (It's possible somebody has 2 accounts in Auth0
  // using the same email.)
  let invitesOrUsers = [];
  for (const auth0User of auth0Users) {
    const { user_id: auth0Id } = auth0User;

    // Auth0 says this could be undefined. If that's the case — even though,
    // we found user(s) — we'll throw an error
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

    // If they exist in auth0 but aren't yet in our database that's a bit unexpected.
    // They need to go through the flow of coming into the app for the first time
    // So we create an invite — it'll turn into a user when they login for the 1st time
    if (!dbUser) {
      const dbInvite = await dbClient.fileInvite.create({
        data: {
          email,
          role,
          fileId,
        },
      });
      invitesOrUsers.push({ email, role, id: dbInvite.id });
    } else {
      // Otherwise associate them as a user of the file. But:
      // If they're already a member of the file, don't bother creating an invite.
      // Just mark them as having already been created. Otherwise, create an invite.
      if (dbUser.UserFileRole.length) {
        invitesOrUsers.push({ id: dbUser.UserFileRole[0].id, role, userId: dbUser.id });
      } else {
        const userFileRole = await dbClient.userFileRole.create({
          data: {
            userId: dbUser.id,
            fileId,
            role,
          },
        });
        invitesOrUsers.push({ id: userFileRole.id, role, userId: userFileRole.userId });
      }
    }
  }

  // Send the email (only once, as the emails are the same across accounts)
  await sendEmail(email, templates.inviteToFile(emailTemplateArgs));

  return res.status(201).json(invitesOrUsers);
}
