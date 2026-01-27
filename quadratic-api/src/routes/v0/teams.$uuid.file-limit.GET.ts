import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { getFileLimitInfo, getIsOnPaidPlan } from '../../utils/billing';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
  query: z.object({
    // Note: 'private' query param is kept for backward compatibility but no longer used
    private: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  }),
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/teams/:uuid/file-limit.GET.response']>) {
  const {
    params: { uuid },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req;

  const { team } = await getTeam({ uuid, userId });
  const isPaidPlan = await getIsOnPaidPlan(team);
  const { isOverLimit, totalFiles, maxEditableFiles } = await getFileLimitInfo(team, isPaidPlan);

  return res.status(200).json({
    // Backward compatible field - now indicates if creating another file would exceed the editable limit
    hasReachedLimit: isOverLimit,
    // New fields for soft limit behavior
    isOverLimit,
    totalFiles,
    maxEditableFiles: isPaidPlan ? undefined : maxEditableFiles,
    isPaidPlan,
  });
}
