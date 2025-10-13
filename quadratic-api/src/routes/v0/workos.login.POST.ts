import { WorkOS } from '@workos-inc/node';
import type { Request, Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { WORKOS_API_KEY, WORKOS_CLIENT_ID } from '../../env-vars';

async function handler(
  req: Request<ApiTypes['/v0/workos/login.POST.request']>,
  res: Response<ApiTypes['/v0/workos/login.POST.response']>
) {
  const workos = new WorkOS(WORKOS_API_KEY, {
    clientId: WORKOS_CLIENT_ID,
  });
  const authorizationUrl = workos.userManagement.getAuthorizationUrl({
    // Specify that we'd like AuthKit to handle the authentication flow
    provider: 'authkit',

    // The callback endpoint that WorkOS will redirect to after a user authenticates
    redirectUri: req.body.redirectTo,
    clientId: WORKOS_CLIENT_ID,
  });

  // Redirect the user to the AuthKit sign-in page
  res.redirect(authorizationUrl);
}

export default [handler];
