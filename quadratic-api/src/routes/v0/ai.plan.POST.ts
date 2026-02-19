import type { Response } from 'express';
import { getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import { DEFAULT_MODEL_START_WITH_AI_PLAN } from 'quadratic-shared/ai/models/AI_MODELS';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { handleAIRequest } from '../../ai/handler/ai.handler';
import { ai_rate_limiter } from '../../ai/middleware/aiRateLimiter';
import { BillingAIUsageLimitExceeded, BillingAIUsageMonthlyForUserInTeam } from '../../billing/AIUsageHelpers';
import { trackAICost } from '../../billing/aiCostTracking.helper';
import { canMakeAiRequest, isFreePlan } from '../../billing/planHelpers';
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
  body: ApiSchemas['/v0/ai/plan.POST.request'],
});

const SYSTEM_PROMPT = `You are an AI assistant helping users plan spreadsheets in Quadratic.

Generate a CONCISE plain text plan for the spreadsheet the user describes. Keep it short and actionable.

IMPORTANT: Do NOT use any markdown formatting. No bullet points (•, -, *), no headers (#), no bold (**), no code blocks. Just plain text with simple line breaks.

Structure your response as plain text, following this format and omitting as necessary:
Goal: Restate the user's goal in one clear sentence

Data (include "being consumed" if data is being used from an existing source; include "being created" if new data is being gathered or created to execute the plan; don't put these in parentheses):
List the name of the data source as well as key columns/fields, one per line, only if data is relevant to answer the query. Data may sometimes not be relevant if it is a calculation or task that does not require data.

Analysis:
Key calculations and/or charts that will be created to answer the query.

Steps:
1. First action
2. Second action
3. Third action
Etc.

Be brief. No lengthy explanations. Plain text only.`;

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/ai/plan.POST.response']>) {
  const {
    user: { id: userId },
  } = req;

  const { body } = parseRequest(req, schema);
  const { teamUuid, prompt, context } = body;

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

  // Ensure the user has at least editor permissions (viewers cannot create files)
  const teamPermissions = getTeamPermissions(userTeamRole.role);
  if (!teamPermissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'User does not have permission to create files in this team');
  }

  // Plan generation is always allowed, even if user has exceeded billing limit
  // This encourages users to try the "Start with AI" flow without penalty
  // However, we still check and track the limit status for reporting
  let exceededBillingLimit = false;
  const isFree = isFreePlan(team);

  if (isFree) {
    if (!isOnPaidPlan) {
      const usage = await BillingAIUsageMonthlyForUserInTeam(userId, team.id);
      exceededBillingLimit = BillingAIUsageLimitExceeded(usage);
    }
  } else {
    // Pro/Business: check but don't block
    const canMakeRequest = await canMakeAiRequest(team, userId);
    exceededBillingLimit = !canMakeRequest.allowed;
  }

  // Abort the request if the client disconnects
  const abortController = new AbortController();
  res.on('close', () => {
    abortController.abort();
  });

  // Build context message
  let contextInfo = '';
  if (context?.files && context.files.length > 0) {
    const fileList = context.files.map((f) => f.name).join(', ');
    contextInfo += `\n\nAttached files: ${fileList}`;

    // Include file contents if available
    for (const file of context.files) {
      const fileWithContent = file as { name: string; type: string; content?: string };
      if (fileWithContent.content) {
        // Limit content to first 50KB to avoid token limits
        const truncatedContent =
          fileWithContent.content.length > 50000
            ? fileWithContent.content.substring(0, 50000) + '\n... (content truncated)'
            : fileWithContent.content;
        contextInfo += `\n\n--- File: ${file.name} ---\n${truncatedContent}\n--- End of ${file.name} ---`;
      }
    }
  }
  if (context?.connectionName) {
    contextInfo += `\n\nSelected database connection: ${context.connectionName} (${context.connectionType || 'unknown type'})`;
  }

  const messages = [
    {
      role: 'user' as const,
      content: [{ type: 'text' as const, text: SYSTEM_PROMPT + contextInfo }],
      contextType: 'userPrompt' as const,
    },
    {
      role: 'user' as const,
      content: [{ type: 'text' as const, text: `Create a plan for the following spreadsheet:\n\n${prompt}` }],
      contextType: 'userPrompt' as const,
    },
  ];

  const modelKey = DEFAULT_MODEL_START_WITH_AI_PLAN;
  const { stream } = getModelOptions(modelKey, { useStream: true, source: 'AIAnalyst' });

  try {
    if (stream) {
      // Set up streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // handleAIRequest streams the response directly to res
      const parsedResponse = await handleAIRequest({
        modelKey,
        args: {
          messages,
          useStream: true,
          source: 'AIAnalyst',
          toolName: undefined,
          useToolsPrompt: false,
          useQuadraticContext: false,
        },
        isOnPaidPlan,
        exceededBillingLimit,
        response: res,
        signal: abortController.signal,
      });

      // Track cost for streaming response
      if (parsedResponse) {
        await trackAICost({
          userId,
          teamId: team.id,
          usage: parsedResponse.usage,
          modelKey,
          source: 'AIAnalyst',
          isFreePlan: isFree,
        });
      }

      return;
    } else {
      // Non-streaming response
      const parsedResponse = await handleAIRequest({
        modelKey,
        args: {
          messages,
          useStream: false,
          source: 'AIAnalyst',
          toolName: undefined,
          useToolsPrompt: false,
          useQuadraticContext: false,
        },
        isOnPaidPlan,
        exceededBillingLimit,
        response: res,
        signal: abortController.signal,
      });

      if (!parsedResponse) {
        throw new ApiError(500, 'Failed to generate plan');
      }

      // Track cost for non-streaming response
      await trackAICost({
        userId,
        teamId: team.id,
        usage: parsedResponse.usage,
        modelKey,
        source: 'AIAnalyst',
        isFreePlan: isFree,
      });

      const planText = parsedResponse.responseMessage.content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map((c) => c.text)
        .join('');

      res.status(200).json({
        plan: planText,
        isOnPaidPlan,
        exceededBillingLimit,
      });
    }
  } catch (error) {
    if (abortController.signal.aborted) {
      return;
    }
    logger.error('Error in ai.plan.POST handler', error);
    throw new ApiError(500, 'Failed to generate plan');
  }
}
