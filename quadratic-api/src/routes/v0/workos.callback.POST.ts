import { WorkOS } from '@workos-inc/node';
import type { Request, Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { setCookiesWorkos } from '../../auth/providers/workos';
import { WORKOS_API_KEY, WORKOS_CLIENT_ID, WORKOS_COOKIE_PASSWORD } from '../../env-vars';
import logger from '../../utils/logger';

async function handler(
  req: Request<ApiTypes['/v0/workos/logout.POST.request']>,
  res: Response<ApiTypes['/v0/workos/logout.POST.response']>
) {
  const workos = new WorkOS(WORKOS_API_KEY, {
    clientId: WORKOS_CLIENT_ID,
  });

  const code = req.query.code as string;

  if (!code) {
    return res.status(400).json({ message: 'No code provided' });
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

    const { sealedSession } = authenticateResponse;
    setCookiesWorkos({ res, sealedSession });

    // todo: deal with "user" if needed

    logger.info('Workos callback successful');

    return res.redirect('/');
  } catch {
    return res.redirect('/login');
  }
}

export default [handler];
