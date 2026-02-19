import type { Response } from 'express';
import { DEFAULT_MODEL_START_WITH_AI_SUGGESTIONS } from 'quadratic-shared/ai/models/AI_MODELS';
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

  // Ensure the user has at least editor permissions (viewers cannot create files)
  const teamPermissions = getTeamPermissions(userTeamRole.role);
  if (!teamPermissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'User does not have permission to create files in this team');
  }

  let exceededBillingLimit = false;
  const isFree = isFreePlan(team);

  // Check billing limits based on plan type
  if (isFree) {
    // Free plan: use existing message limit check
    if (!isOnPaidPlan) {
      const usage = await BillingAIUsageMonthlyForUserInTeam(userId, team.id);
      exceededBillingLimit = BillingAIUsageLimitExceeded(usage);
    }
  } else {
    // Pro/Business plan: check allowance and budget limits
    const canMakeRequest = await canMakeAiRequest(team, userId);
    exceededBillingLimit = !canMakeRequest.allowed;
  }

  if (exceededBillingLimit) {
    res.status(200).json({
      suggestions: [],
      isOnPaidPlan,
      exceededBillingLimit,
    });
    return;
  }

  // Build context description and content parts
  let contextDesc = '';
  const contentParts: Array<
    { type: 'text'; text: string } | { type: 'data'; mimeType: 'application/pdf'; data: string; fileName: string }
  > = [];

  if (context?.files && context.files.length > 0) {
    const fileList = context.files.map((f) => f.name).join(', ');
    contextDesc += `Attached files: ${fileList}`;

    // Include file contents if available
    for (const file of context.files) {
      const fileWithContent = file as {
        name: string;
        type: string;
        content?: string;
        contentEncoding?: 'text' | 'base64';
      };
      if (fileWithContent.content) {
        if (fileWithContent.contentEncoding === 'base64') {
          // PDF or other binary file - add as file part for Gemini
          contentParts.push({
            type: 'data',
            mimeType: 'application/pdf',
            data: fileWithContent.content,
            fileName: file.name,
          });
          contextDesc += `\n\n[PDF file "${file.name}" attached above]`;
        } else {
          // Text file - include inline
          contextDesc += `\n\n--- File: ${file.name} ---\n${fileWithContent.content}\n--- End of ${file.name} ---`;
        }
      }
    }
  }
  if (context?.connectionName) {
    contextDesc += `${contextDesc ? '\n\n' : ''}Selected database connection: ${context.connectionName} (${context.connectionType || 'unknown type'})`;
  }

  // Build message content - PDFs first, then text prompt
  const messageContent: Array<
    { type: 'text'; text: string } | { type: 'data'; mimeType: 'application/pdf'; data: string; fileName: string }
  > = [...contentParts, { type: 'text' as const, text: `${SYSTEM_PROMPT}\n\nContext: ${contextDesc}` }];

  const messages = [
    {
      role: 'user' as const,
      content: messageContent,
      contextType: 'userPrompt' as const,
    },
  ];

  logger.info('Starting AI suggestions request', { contextDesc, model: DEFAULT_MODEL_START_WITH_AI_SUGGESTIONS });

  // Create abort controller with timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    logger.warn('AI suggestions request timed out after 30s');
    abortController.abort();
  }, 30000);

  try {
    const parsedResponse = await handleAIRequest({
      modelKey: DEFAULT_MODEL_START_WITH_AI_SUGGESTIONS,
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

    // Track cost for AI suggestions request
    await trackAICost({
      userId,
      teamId: team.id,
      usage: parsedResponse.usage,
      modelKey: DEFAULT_MODEL_START_WITH_AI_SUGGESTIONS,
      source: 'AIAnalyst',
      isFreePlan: isFree,
    });

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
