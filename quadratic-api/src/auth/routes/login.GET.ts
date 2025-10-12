import { WorkOS } from '@workos-inc/node';
import cookieParser from 'cookie-parser';
import express from 'express';
import { WORKOS_API_KEY, WORKOS_CLIENT_ID } from '../../env-vars';

export const authLogin = express.Router();
const workos = new WorkOS(WORKOS_API_KEY, { clientId: WORKOS_CLIENT_ID });

authLogin.use(cookieParser());

// This `/login` endpoint should be registered as the login endpoint
// on the "Redirects" page of the WorkOS Dashboard.
authLogin.get('/login', (req, res) => {
  const authorizationUrl = workos.userManagement.getAuthorizationUrl({
    // Specify that we'd like AuthKit to handle the authentication flow
    provider: 'authkit',

    // The callback endpoint that WorkOS will redirect to after a user authenticates
    // TODO
    redirectUri: 'http://localhost:3000/',
    clientId: WORKOS_CLIENT_ID,
  });

  // Redirect the user to the AuthKit sign-in page
  res.redirect(authorizationUrl);
});
