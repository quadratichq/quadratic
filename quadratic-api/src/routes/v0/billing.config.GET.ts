import type { Request, Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { AI_ALLOWANCE_BUSINESS, AI_ALLOWANCE_PRO } from '../../env-vars';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';

export default [validateAccessToken, userMiddleware, handler];

async function handler(_req: Request, res: Response<ApiTypes['/v0/billing/config.GET.response']>) {
  return res.status(200).json({
    proAiAllowance: AI_ALLOWANCE_PRO,
    businessAiAllowance: AI_ALLOWANCE_BUSINESS,
  });
}
