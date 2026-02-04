import type { Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI } from '../../env-vars';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({ uuid: z.string().uuid() }),
});

/**
 * Generate Google OAuth authorization URL
 *
 * This endpoint creates an OAuth URL that the frontend uses to redirect
 * users to Google's consent screen for authorizing access to Google Analytics.
 *
 * GET /v0/teams/:uuid/google/auth-url
 */
async function handler(req: RequestWithUser, res: Response<{ authUrl: string }>) {
  const {
    user: { id: userId },
  } = req;
  const {
    params: { uuid },
  } = parseRequest(req, schema);

  const {
    userMakingRequest: { permissions },
  } = await getTeam({ uuid, userId });

  // Check permissions
  if (!permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, "You don't have access to create connections for this team");
  }

  // Create OAuth2 client
  const oauth2Client = new OAuth2Client(
    GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT_URI
  );

  // Generate authorization URL with required scopes for Google Analytics
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Required to get refresh token
    scope: ['https://www.googleapis.com/auth/analytics.readonly'],
    prompt: 'consent', // Force consent to always get refresh token
    state: uuid, // Pass team UUID for security/context
  });

  return res.status(200).json({ authUrl });
}

