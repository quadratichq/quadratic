import crypto from 'crypto';
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
async function handler(req: RequestWithUser, res: Response<{ authUrl: string; nonce: string; codeVerifier: string }>) {
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

  // Generate a cryptographic nonce for CSRF protection
  const nonce = crypto.randomBytes(16).toString('hex');

  // Create OAuth2 client
  const oauth2Client = new OAuth2Client(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI);

  // Generate PKCE code verifier and challenge
  const { codeVerifier, codeChallenge } = await oauth2Client.generateCodeVerifierAsync();

  // Encode team UUID and nonce in the state parameter for CSRF protection
  const state = JSON.stringify({ teamUuid: uuid, nonce });

  // Generate authorization URL with required scopes for Google Analytics
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Required to get refresh token
    scope: ['https://www.googleapis.com/auth/analytics.readonly'],
    prompt: 'consent', // Force consent to always get refresh token
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return res.status(200).json({ authUrl, nonce, codeVerifier });
}
