import { WorkOS } from '@workos-inc/node';
import type { Request, Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { WORKOS_API_KEY, WORKOS_CLIENT_ID } from '../../env-vars';
import logger from '../../utils/logger';

async function handler(
  req: Request<ApiTypes['/v0/workos/logout.POST.request']>,
  res: Response<ApiTypes['/v0/workos/logout.POST.response']>
) {
  const workos = new WorkOS(WORKOS_API_KEY, {
    clientId: WORKOS_CLIENT_ID,
  });
  await workos.userManagement.revokeSession({ sessionId: req.cookies['wos-session'] });

  logger.info('Workos logout successful');
  res.status(200);
}

export default [handler];
