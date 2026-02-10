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
import logger from '../../utils/logger';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: z.object({
    refreshToken: z.string().min(1),
  }),
  params: z.object({ uuid: z.string().uuid() }),
});

/**
 * Refresh Google OAuth access token
 *
 * This endpoint uses a refresh token to obtain a new access token
 * when the current access token has expired.
 *
 * POST /v0/teams/:uuid/google/refresh-token
 */
async function handler(req: RequestWithUser, res: Response<{ accessToken: string; expiresAt: string }>) {
  const {
    user: { id: userId },
  } = req;
  const {
    body: { refreshToken },
    params: { uuid },
  } = parseRequest(req, schema);

  const {
    userMakingRequest: { permissions },
  } = await getTeam({ uuid, userId });

  // Check permissions
  if (!permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, "You don't have access to refresh tokens for this team");
  }

  try {
    // Create OAuth2 client
    const oauth2Client = new OAuth2Client(
      GOOGLE_OAUTH_CLIENT_ID,
      GOOGLE_OAUTH_CLIENT_SECRET,
      GOOGLE_OAUTH_REDIRECT_URI
    );

    // Set the refresh token
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    // Get new access token
    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new ApiError(500, 'Failed to refresh access token');
    }

    // Calculate expiration time
    const expiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString(); // Default to 1 hour if not provided

    return res.status(200).json({
      accessToken: credentials.access_token,
      expiresAt,
    });
  } catch (error) {
    logger.error('Error refreshing Google OAuth token:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to refresh Google OAuth token. User may need to re-authenticate.');
  }
}

