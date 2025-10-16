import { WorkOS } from '@workos-inc/node';
import type { NextFunction, Response } from 'express';
import express from 'express';
import { AUTH_CORS, WORKOS_API_KEY, WORKOS_CLIENT_ID } from '../../env-vars';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import type { Request } from '../../types/Request';
import logger from '../../utils/logger';
import { clearCookies } from '../providers/auth';

const authorizeRouter = express.Router();

const workos = new WorkOS(WORKOS_API_KEY, {
  clientId: WORKOS_CLIENT_ID,
});

// Helper to generate the redirect URL to the WorkOS sign-in page
const getAuthorizationUrl = async (redirectTo?: string) => {
  const redirectUri = `${AUTH_CORS}/login-result`;
  const state = redirectTo ? JSON.stringify({ redirectTo }) : undefined;

  return workos.userManagement.getAuthorizationUrl({
    clientId: WORKOS_CLIENT_ID,
    provider: 'authkit',
    redirectUri,
    state,
  });
};

authorizeRouter.get('/', async (req: Request, res: Response, _next: NextFunction) => {
  // Check for an Authorization header
  if (!req.headers.authorization) {
    clearCookies({ res });
    const redirectTo = req.query.redirectTo as string | undefined;
    const authUrl = await getAuthorizationUrl(redirectTo);
    return res.redirect(authUrl);
  }

  // Validate the access token
  validateAccessToken(req, res, async (error) => {
    try {
      if (error) {
        if (error instanceof Error && !error.message.includes('jwt') && !error.message.includes('expired')) {
          logger.info('/user_management/authorize.GET error', error);
        }
        clearCookies({ res });
        const redirectTo = req.query.redirectTo as string | undefined;
        const authUrl = await getAuthorizationUrl(redirectTo);
        return res.redirect(authUrl);
      }

      // Token is valid, return user info
      const accessToken = req.headers.authorization?.substring(7); // Remove 'Bearer ' prefix
      return res.status(200).json({
        user: req.auth,
        access_token: accessToken,
      });
    } catch (err) {
      logger.error('Unexpected error in authorize.GET', err);
      clearCookies({ res });
      const redirectTo = req.query.redirectTo as string | undefined;
      const authUrl = await getAuthorizationUrl(redirectTo);
      return res.redirect(authUrl);
    }
  });
});

export default authorizeRouter;
