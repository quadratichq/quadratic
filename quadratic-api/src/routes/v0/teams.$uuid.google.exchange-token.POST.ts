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
    code: z.string().min(1),
    state: z.string().min(1),
    codeVerifier: z.string().min(1),
  }),
  params: z.object({ uuid: z.string().uuid() }),
});

/**
 * Exchange Google OAuth authorization code for tokens
 *
 * This endpoint receives the authorization code from Google OAuth callback
 * and exchanges it for access and refresh tokens.
 *
 * POST /v0/teams/:uuid/google/exchange-token
 */
async function handler(
  req: RequestWithUser,
  res: Response<{ accessToken: string; refreshToken: string; expiresAt: string }>
) {
  const {
    user: { id: userId },
  } = req;
  const {
    body: { code, state, codeVerifier },
    params: { uuid },
  } = parseRequest(req, schema);

  // Verify the OAuth state parameter matches this team to prevent CSRF
  try {
    const parsedState = JSON.parse(state);
    if (parsedState.teamUuid !== uuid) {
      throw new ApiError(400, 'Invalid OAuth state: team UUID mismatch');
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'Invalid OAuth state parameter');
  }

  const {
    userMakingRequest: { permissions },
  } = await getTeam({ uuid, userId });

  // Check permissions
  if (!permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, "You don't have access to create connections for this team");
  }

  try {
    // Create OAuth2 client
    const oauth2Client = new OAuth2Client(
      GOOGLE_OAUTH_CLIENT_ID,
      GOOGLE_OAUTH_CLIENT_SECRET,
      GOOGLE_OAUTH_REDIRECT_URI
    );

    // Exchange authorization code for tokens with PKCE verification
    const { tokens } = await oauth2Client.getToken({ code, codeVerifier });

    if (!tokens.access_token) {
      throw new ApiError(500, 'Failed to get access token from Google');
    }

    if (!tokens.refresh_token) {
      throw new ApiError(
        500,
        'Failed to get refresh token from Google. Please try again and ensure you grant offline access.'
      );
    }

    // Calculate expiration time
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString(); // Default to 1 hour if not provided

    return res.status(200).json({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
    });
  } catch (error) {
    logger.error('Error exchanging Google OAuth code:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to exchange Google OAuth authorization code');
  }
}
