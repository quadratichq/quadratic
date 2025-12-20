import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { getUsers } from '../../auth/providers/auth';
import dbClient from '../../dbClient';
import { addTeamInviteToMailchimp } from '../../email/mailchimp';
import { sendEmail } from '../../email/sendEmail';
import { templates } from '../../email/templates';
import { addUserToTeam } from '../../internal/addUserToTeam';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { firstRoleIsHigherThanSecond } from '../../utils/permissions';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
  body: ApiSchemas['/v0/teams/:uuid/invites.POST.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/teams/:uuid/invites.POST.response']>) {
  const {
    body: { email, role },
    params: { uuid },
  } = parseRequest(req, schema);
  const {
    user: { id: userMakingRequestId, auth0Id: userMakingRequestAuth0Id, email: userMakingRequestEmail },
  } = req;
  const {
    team: { id: teamId, name: teamName },
    userMakingRequest: { permissions, role: userMakingRequestRole },
  } = await getTeam({ uuid, userId: userMakingRequestId });

  // ***************************************************************************
  // A note before we begin:
  // A lot of the logic here is shared with the file invite. If you modify
  // something here, it’s very possible you’ll need to modify it there too.
  // ***************************************************************************

  // Can you even invite others?
  if (!permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You do not have permission to invite others to this team.');
  }

  // Are you trying to invite someone to a role higher than your own? No go
  if (firstRoleIsHigherThanSecond(role, userMakingRequestRole)) {
    throw new ApiError(403, 'You cannot invite someone to a role higher than their own.');
  }

  // Are you trying to create an invite that already exists? That's a conflict
  // (We don't want to figure out if you're updating the existing record or not)
  const existingInvite = await dbClient.teamInvite.findUnique({
    where: {
      email_teamId: {
        email,
        teamId,
      },
    },
  });
  if (existingInvite) {
    throw new ApiError(409, 'An invite with this email already exists.');
  }

  // Get the auth0 info (email/name) for the user making the request
  const resultsById = await getUsers([
    { id: userMakingRequestId, auth0Id: userMakingRequestAuth0Id, email: userMakingRequestEmail },
  ]);
  const { name: userMakingRequestName } = resultsById[userMakingRequestId];

  // Stuff for sending email
  const emailTemplateArgs = {
    senderName: userMakingRequestName,
    senderEmail: userMakingRequestEmail,
    teamName,
    teamRole: role,
    teamUuid: uuid,
    origin: String(req.headers.origin),
  };
  const createInviteAndSendEmail = async () => {
    const dbInvite = await dbClient.teamInvite.create({
      data: {
        email,
        role,
        teamId,
      },
    });

    // Send immediate invite email via SendGrid
    await sendEmail(email, templates.inviteToTeam(emailTemplateArgs));

    // Add to Mailchimp for follow-up drip campaign (non-blocking)
    addTeamInviteToMailchimp({
      email,
      teamName,
      teamUuid: uuid,
      inviterName: userMakingRequestName,
      inviterEmail: userMakingRequestEmail,
    });

    return dbInvite;
  };

  // Look up the invited user by email in our database and then 1 of 2 things will happen:
  const invitedUser = await dbClient.user.findUnique({
    where: {
      email,
    },
    include: {
      UserTeamRole: {
        where: {
          teamId,
        },
      },
    },
  });

  // 1.
  // If user doesn't exist, somebody who doesn't have a Quadratic account is
  // being invited. So we create an invite and send an email.
  if (!invitedUser) {
    const dbInvite = await createInviteAndSendEmail();
    return res.status(201).json({ email: dbInvite.email, role: dbInvite.role, id: dbInvite.id });
  }

  // 2.
  // If there is a user, they are an existing user of Quadratic. So we
  // associate them with the team and send them an email.

  // Are they already a team user? That's a conflict.
  if (invitedUser.UserTeamRole.length) {
    throw new ApiError(409, 'This user already belongs to this team.');
  }

  // Otherwise associate them as a user of the team and send them an email
  const userTeamRole = await addUserToTeam({ userId: invitedUser.id, teamId, role });
  await sendEmail(email, templates.inviteToTeam(emailTemplateArgs));
  return res.status(200).json({ id: userTeamRole.id, role: userTeamRole.role, userId: userTeamRole.userId });
}
