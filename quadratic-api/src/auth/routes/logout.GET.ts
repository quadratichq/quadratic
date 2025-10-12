import { WorkOS } from '@workos-inc/node';
import express from 'express';
import { WORKOS_API_KEY, WORKOS_CLIENT_ID, WORKOS_COOKIE_PASSWORD } from '../../env-vars';

export const authLogout = express.Router();
const workos = new WorkOS(WORKOS_API_KEY, { clientId: WORKOS_CLIENT_ID });

authLogout.get('/logout', async (req, res) => {
  const session = workos.userManagement.loadSealedSession({
    sessionData: req.cookies['wos-session'],
    cookiePassword: WORKOS_COOKIE_PASSWORD,
  });

  const url = await session.getLogoutUrl();

  res.clearCookie('wos-session');
  res.redirect(url);
});
