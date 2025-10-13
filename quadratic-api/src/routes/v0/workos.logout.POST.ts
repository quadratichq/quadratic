import { WorkOS } from '@workos-inc/node';
import type { Request, Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { WORKOS_API_KEY, WORKOS_CLIENT_ID } from '../../env-vars';

async function handler(
  req: Request<ApiTypes['/v0/workos/logout.POST.request']>,
  res: Response<ApiTypes['/v0/workos/logout.POST.response']>
) {
  const { redirectTo } = req.body;
  const workos = new WorkOS(WORKOS_API_KEY, {
    clientId: WORKOS_CLIENT_ID,
  });
  await workos.userManagement.revokeSession({ sessionId: req.cookies['wos-session'] });
  res.redirect(redirectTo);
}

export default [handler];
