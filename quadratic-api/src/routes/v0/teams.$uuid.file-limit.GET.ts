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

  // hasReachedLimit: true when at or over limit (can't create more files)
  // isOverLimit: true when over limit (some files are not editable, show banner)
  const hasReachedLimit = isPaidPlan ? false : totalFiles >= maxEditableFiles;

  return res.status(200).json({
    // Backward compatible field - indicates if creating another file would exceed the editable limit
    hasReachedLimit,
    // New fields for soft limit behavior
    isOverLimit,
    totalFiles,
    maxEditableFiles: isPaidPlan ? undefined : maxEditableFiles,
    isPaidPlan,
  });
}
