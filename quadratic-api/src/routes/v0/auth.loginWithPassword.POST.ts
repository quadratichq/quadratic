import type { Response } from 'express';
import { ApiSchemas, type ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { loginWithPassword } from '../../auth/auth';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { Request } from '../../types/Request';

export default [handler];

const schema = z.object({
  body: ApiSchemas['/v0/auth/loginWithPassword.POST.request'],
});

async function handler(req: Request, res: Response<ApiTypes['/v0/auth/loginWithPassword.POST.response']>) {
  try {
    const {
      body: { email, password },
    } = parseRequest(req, schema);

    const response = await loginWithPassword({ email, password });
    const parsedResponse = ApiSchemas['/v0/auth/loginWithPassword.POST.response'].parse(response);
    return res.status(200).json(parsedResponse);
  } catch {
    return res.status(401).json({ refreshToken: undefined });
  }
}
