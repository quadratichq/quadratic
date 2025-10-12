import { WorkOS } from '@workos-inc/node';
import express from 'express';
import { WORKOS_API_KEY, WORKOS_CLIENT_ID, WORKOS_COOKIE_PASSWORD } from '../../env-vars';
import logger from '../../utils/logger';

export const authCallback = express.Router();
const workos = new WorkOS(WORKOS_API_KEY, { clientId: WORKOS_CLIENT_ID });

authCallback.get('/callback', async (req, res) => {
  // The authorization code returned by AuthKit
  const code: string | undefined = req.query.code as string;

  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    const authenticateResponse = await workos.userManagement.authenticateWithCode({
      code,
      clientId: WORKOS_CLIENT_ID,
      session: {
        sealSession: true,
        cookiePassword: WORKOS_COOKIE_PASSWORD,
      },
    });

    const { user, sealedSession } = authenticateResponse;

    // Store the session in a cookie
    res.cookie('wos-session', sealedSession, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });

    // Use the information in `user` for further business logic.
    console.log(user);

    return res.redirect('/');
  } catch (error) {
    logger.error('/v0/auth/authCallback.GET.response', error);
    return res.redirect('/login');
  }
});
