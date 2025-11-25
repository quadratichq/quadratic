import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import type { AIModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { z } from 'zod';
import { handleAIRequest } from '../../ai/handler/ai.handler';
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

// Use Gemini for fast, non-streaming suggestions
const SUGGESTIONS_MODEL: AIModelKey = 'vertexai:gemini-2.5-flash-lite:thinking-toggle-off';

export default [validateAccessToken, ai_rate_limiter, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/ai/suggestions.POST.request'],
});

const SYSTEM_PROMPT = `You are an AI assistant helping users discover useful spreadsheet projects in Quadratic.

Based on the context provided (attached files and/or database connections), generate exactly 3 relevant spreadsheet project suggestions.

Each suggestion should be:
- Specific to the data/connection provided
- Actionable and clear
- Something valuable the user can actually build

Respond ONLY with a valid JSON array (no other text, no markdown, no code blocks):
[
  {"title": "Short Title", "description": "Brief 5-8 word description", "prompt": "Full prompt describing what to create"},
  {"title": "Short Title", "description": "Brief 5-8 word description", "prompt": "Full prompt describing what to create"},
  {"title": "Short Title", "description": "Brief 5-8 word description", "prompt": "Full prompt describing what to create"}
]`;

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/ai/suggestions.POST.response']>) {
  const {
    user: { id: userId },
  } = req;

  const { body } = parseRequest(req, schema);
  const { teamUuid, context } = body;

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

  let exceededBillingLimit = false;

  // Check billing limits for non-paid plans
  if (!isOnPaidPlan) {
    const usage = await BillingAIUsageMonthlyForUserInTeam(userId, team.id);
    exceededBillingLimit = BillingAIUsageLimitExceeded(usage);

    if (exceededBillingLimit) {
      res.status(200).json({
        suggestions: [],
        isOnPaidPlan,
        exceededBillingLimit,
      });
      return;
    }
  }

  // Build context description
  let contextDesc = '';
  if (context?.files && context.files.length > 0) {
    contextDesc += `Files: ${context.files.map((f) => `${f.name} (${f.type})`).join(', ')}`;
  }
  if (context?.connectionName) {
    contextDesc += `${contextDesc ? '. ' : ''}Database: ${context.connectionName} (${context.connectionType || 'unknown type'})`;
  }

  const messages = [
    {
      role: 'user' as const,
      content: [{ type: 'text' as const, text: `${SYSTEM_PROMPT}\n\nContext: ${contextDesc}` }],
      contextType: 'userPrompt' as const,
    },
  ];

  logger.info('Starting AI suggestions request', { contextDesc, model: SUGGESTIONS_MODEL });

  // Create abort controller with timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    logger.warn('AI suggestions request timed out after 30s');
    abortController.abort();
  }, 30000);

  try {
    const parsedResponse = await handleAIRequest({
      modelKey: SUGGESTIONS_MODEL,
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
      signal: abortController.signal,
    });

    clearTimeout(timeoutId);
    logger.info('AI suggestions request completed', { hasResponse: !!parsedResponse });

    if (!parsedResponse) {
      logger.warn('AI request returned no response, returning empty suggestions');
      res.status(200).json({
        suggestions: [],
        isOnPaidPlan,
        exceededBillingLimit,
      });
      return;
    }

    const responseText = parsedResponse.responseMessage.content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map((c) => c.text)
      .join('');

    // Parse the JSON from the response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.warn('Failed to parse suggestions JSON from response, returning empty suggestions', { responseText });
      res.status(200).json({
        suggestions: [],
        isOnPaidPlan,
        exceededBillingLimit,
      });
      return;
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        title: string;
        description: string;
        prompt: string;
      }>;

      res.status(200).json({
        suggestions: parsed,
        isOnPaidPlan,
        exceededBillingLimit,
      });
    } catch (parseError) {
      logger.warn('Failed to parse suggestions JSON', { jsonMatch: jsonMatch[0], parseError });
      res.status(200).json({
        suggestions: [],
        isOnPaidPlan,
        exceededBillingLimit,
      });
    }
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort/timeout gracefully
    if (abortController.signal.aborted) {
      logger.warn('AI suggestions request was aborted or timed out');
      res.status(200).json({
        suggestions: [],
        isOnPaidPlan,
        exceededBillingLimit,
      });
      return;
    }

    // Log the actual error details
    if (error instanceof ApiError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('Error in ai.suggestions.POST handler', { message: errorMessage, stack: errorStack, error });

    // Return empty suggestions instead of throwing to keep UI functional
    res.status(200).json({
      suggestions: [],
      isOnPaidPlan,
      exceededBillingLimit,
    });
  }
}
