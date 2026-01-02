import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { handleLangChainCanvasRequest } from '../../ai/handler/langchain.canvas.handler';
import { ai_rate_limiter } from '../../ai/middleware/aiRateLimiter';
import { BillingAIUsageLimitExceeded, BillingAIUsageMonthlyForUserInTeam } from '../../billing/AIUsageHelpers';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { getIsOnPaidPlan } from '../../utils/billing';
import logger from '../../utils/logger';
import { getTeamPermissions } from '../../utils/permissions';

export default [validateAccessToken, ai_rate_limiter, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/ai/canvas.POST.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/ai/canvas.POST.response']>) {
  const {
    user: { id: userId },
  } = req;

  const { body } = parseRequest(req, schema);
  const { teamUuid, prompt, systemPrompt, connections } = body;

  // Look up the team
  const team = await dbClient.team.findUnique({
    where: { uuid: teamUuid },
  });

  if (!team) {
    throw new ApiError(404, 'Team not found');
  }

  // Check if the team is on a paid plan
  const isOnPaidPlan = await getIsOnPaidPlan(team);

  // Get the user's role in this team
  const userTeamRole = await dbClient.userTeamRole.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId: team.id,
      },
    },
  });

  if (!userTeamRole) {
    throw new ApiError(403, 'User is not a member of this team');
  }

  // Ensure the user has at least editor permissions
  const teamPermissions = getTeamPermissions(userTeamRole.role);
  if (!teamPermissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'User does not have permission to use Canvas');
  }

  let exceededBillingLimit = false;
  if (!isOnPaidPlan) {
    const usage = await BillingAIUsageMonthlyForUserInTeam(userId, team.id);
    exceededBillingLimit = BillingAIUsageLimitExceeded(usage);

    if (exceededBillingLimit) {
      res.status(200).json({
        content: 'You have exceeded your AI usage limit for this billing period.',
        toolCalls: [],
        isOnPaidPlan,
        exceededBillingLimit,
      });
      return;
    }
  }

  // Abort the request if the client disconnects
  const abortController = new AbortController();
  req.socket.on('close', () => {
    abortController.abort();
  });

  try {
    // Use LangChain handler for Canvas
    await handleLangChainCanvasRequest(
      {
        prompt,
        systemPrompt,
        connections,
        signal: abortController.signal,
      },
      res
    );
  } catch (error) {
    if (abortController.signal.aborted) {
      return;
    }
    logger.error('Error in ai.canvas.POST handler', error);
    throw new ApiError(500, 'Failed to process AI request');
  }
}

