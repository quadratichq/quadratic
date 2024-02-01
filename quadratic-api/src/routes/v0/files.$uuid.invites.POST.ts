import * as Sentry from '@sentry/node';
import { Response } from 'express';
import { ApiSchemas, ApiTypes, FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { getUsersFromAuth0, lookupUsersFromAuth0ByEmail } from '../../auth0/profile';
import dbClient from '../../dbClient';
import { sendEmail } from '../../email/sendEmail';
import { templates } from '../../email/templates';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
const { FILE_EDIT } = FilePermissionSchema.enum;

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
  body: ApiSchemas['/v0/files/:uuid/invites.POST.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/files/:uuid/invites.POST.response']>) {
  const {
    body: { email, role },
    params: { uuid },
  } = parseRequest(req, schema);
  const {
    user: { id: userMakingRequestId, auth0Id: userMakingRequestAuth0Id },
  } = req;
  const {
    file: { id: fileId, name: fileName, ownerUserId },
    userMakingRequest: { filePermissions },
  } = await getFile({ uuid, userId: userMakingRequestId });

  // Can you even invite others?
  if (!filePermissions.includes(FILE_EDIT)) {
    throw new ApiError(403, 'You do not have permission to invite others to this file.');
  }

  // Are you trying to create an invite that already exists? That's a conflict
  // (We don't want to figure out if you're updating the exisiting record or not)
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

  // Get the auth0 info (email/name) for the user making the request
  const resultsById = await getUsersFromAuth0([{ id: userMakingRequestId, auth0Id: userMakingRequestAuth0Id }]);
  const { email: userMakingRequestEmail, name: userMakingRequestName } = resultsById[userMakingRequestId];
  const emailTemplateArgs = {
    senderName: userMakingRequestName,
    senderEmail: userMakingRequestEmail,
    fileName,
    fileRole: role,
    fileUuid: uuid,
    origin: String(req.headers.origin),
  };

  // Are you trying to invite yourself as the file owner? No dice.
  if (userMakingRequestId === ownerUserId && userMakingRequestEmail === email) {
    throw new ApiError(400, 'As the file owner you cannot invite yourself to the file.');
  }

  const createInviteAndSendEmail = async () => {
    const dbInvite = await dbClient.fileInvite.create({
      data: {
        email,
        role,
        fileId,
      },
    });
    await sendEmail(email, templates.inviteToFile(emailTemplateArgs));
    return dbInvite;
  };

  // Look up the invited user by email in Auth0 and then 1 of 3 things will happen:
  const auth0Users = await lookupUsersFromAuth0ByEmail(email);

  // 1.
  // If there are 0 users, somebody who doesn't have a Quadratic account is
  // being invited. So we create an invite and send an email.
  if (auth0Users.length === 0) {
    const dbInvite = await createInviteAndSendEmail();
    return res.status(201).json({ email, role, id: dbInvite.id });
  }

  // 2.
  // If there is 1 user, they are an exisiting user of Quadratic. So we
  // associate them with the file and send them an email.
  if (auth0Users.length === 1) {
    const { user_id: auth0Id } = auth0Users[0];

    // Auth0 says this could be undefined. If that's the case — even though,
    // we found user(s) — we'll throw an error
    if (!auth0Id) {
      throw new ApiError(500, 'User found in auth0 but expected `user_id` is not present');
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
    // So we create an invite (it'll turn into a user when they login for the 1st time)
    if (!dbUser) {
      const dbInvite = await createInviteAndSendEmail();
      return res.status(201).json({ email, role, id: dbInvite.id });
    }

    // Are they already a file user? That's a conflict.
    if (dbUser.UserFileRole.length) {
      throw new ApiError(409, 'This user already belongs to this file.');
    }
    // Are they the owner? No go.
    if (dbUser.id === ownerUserId) {
      throw new ApiError(400, 'This user is the owner of this file.');
    }

    // Otherwise associate them as a user of the file and send them an email
    const userFileRole = await dbClient.userFileRole.create({
      data: {
        userId: dbUser.id,
        fileId,
        role,
      },
    });
    await sendEmail(email, templates.inviteToFile(emailTemplateArgs));
    return res.status(200).json({ id: userFileRole.id, role, userId: userFileRole.userId });
  }

  // 3.
  // There are 2 or more users in auth0 with that email. This is unexpected
  // so we throw and log the error.
  throw new ApiError(500, 'Internal server error: user lookup error.');
  Sentry.captureEvent({
    message: 'User has 3 or more accounts in auth0 with the same email.',
    level: 'error',
    extra: {
      auth0Users,
    },
  });
}
