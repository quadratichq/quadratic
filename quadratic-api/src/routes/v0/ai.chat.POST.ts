import type { AnalyticsAIChat } from '@prisma/client';
import type { Response } from 'express';
import {
  getLastAIPromptMessageIndex,
  getLastUserMessage,
  getLastUserMessageType,
  isContentText,
} from 'quadratic-shared/ai/helpers/message.helper';
import { getModelFromModelKey, getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { AILanguagePreferencesSchema, type AIModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { z } from 'zod';
import { handleAIRequest } from '../../ai/handler/ai.handler';
import {
  getAILanguagesContext,
  getAIRulesContext,
  getQuadraticContext,
  getToolUseContext,
} from '../../ai/helpers/context.helper';
import { getModelKey } from '../../ai/helpers/modelRouter.helper';
import { ai_rate_limiter } from '../../ai/middleware/aiRateLimiter';
import { raindrop } from '../../analytics/raindrop';
import { BillingAIUsageLimitExceeded, BillingAIUsageMonthlyForUserInTeam } from '../../billing/AIUsageHelpers';
import { toAIChatSource, trackAICost } from '../../billing/aiCostTracking.helper';
import { canMakeAiRequest, isFreePlan } from '../../billing/planHelpers';
import dbClient from '../../dbClient';
import { STORAGE_TYPE } from '../../env-vars';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { getBucketName, S3Bucket } from '../../storage/s3';
import { uploadFile } from '../../storage/storage';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { getIsOnPaidPlan } from '../../utils/billing';
import { isRestrictedModelCountry } from '../../utils/geolocation';
import logger from '../../utils/logger';

export default [validateAccessToken, ai_rate_limiter, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/ai/chat.POST.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/ai/chat.POST.response']>) {
  const {
    user: { id: userId, email: userEmail },
  } = req;

  const jwt = req.header('Authorization');
  if (!jwt) {
    throw new ApiError(403, 'User does not have a valid JWT.');
  }

  const { body } = parseRequest(req, schema);
  const { chatId, fileUuid, messageSource, modelKey: clientModelKey, ...args } = body;

  const {
    file: { id: fileId, ownerTeam },
  } = await getFile({ uuid: fileUuid, userId });

  // Fetch user and team AI rules and language preferences
  const [user, team] = await Promise.all([
    dbClient.user.findUnique({
      where: { id: userId },
      select: { aiRules: true, aiLanguages: true },
    }),
    dbClient.team.findUnique({
      where: { id: ownerTeam.id },
      select: { aiRules: true },
    }),
  ]);

  // Check if the file's owner team is on a paid plan
  const isOnPaidPlan = await getIsOnPaidPlan(ownerTeam);

  // Get the user's role in this owner team
  const userTeamRole = await dbClient.userTeamRole.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId: ownerTeam.id,
      },
    },
  });

  let exceededBillingLimit = false;

  const messageType = getLastUserMessageType(args.messages);
  const isFree = isFreePlan(ownerTeam);

  if (messageType === 'userPrompt') {
    if (isFree) {
      // Free plan: use existing message limit check
      if (!isOnPaidPlan || !userTeamRole) {
        const usage = await BillingAIUsageMonthlyForUserInTeam(userId, ownerTeam.id);
        exceededBillingLimit = BillingAIUsageLimitExceeded(usage);
      }
    } else {
      // Pro/Business plan: check allowance and budget limits
      const canMakeRequest = await canMakeAiRequest(ownerTeam, userId);
      if (!canMakeRequest.allowed) {
        exceededBillingLimit = true;
      }
    }

    if (exceededBillingLimit) {
      // Get plan type and overage settings for the response
      const teamWithBilling = ownerTeam as typeof ownerTeam & {
        planType?: string | null;
        allowOveragePayments?: boolean;
      };
      const planType = (teamWithBilling.planType as 'FREE' | 'PRO' | 'BUSINESS') ?? (isFree ? 'FREE' : 'PRO');
      const allowOveragePayments = teamWithBilling.allowOveragePayments ?? false;

      const responseMessage: ApiTypes['/v0/ai/chat.POST.response'] = {
        role: 'assistant',
        content: [],
        contextType: 'userPrompt',
        toolCalls: [],
        modelKey: clientModelKey,
        isOnPaidPlan,
        exceededBillingLimit,
        planType,
        allowOveragePayments,
      };

      const { stream } = getModelOptions(clientModelKey, args);

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify(responseMessage)}\n\n`);
        res.end();
        return;
      } else {
        res.status(200).json(responseMessage);
      }

      return;
    }
  }

  // Abort the request if the client disconnects or aborts the request
  const abortController = new AbortController();
  res.on('close', () => {
    abortController.abort();
  });

  const source = args.source;
  const restrictedCountry = isRestrictedModelCountry(req, isOnPaidPlan);
  let modelKey = await getModelKey(
    clientModelKey,
    args,
    isOnPaidPlan,
    exceededBillingLimit,
    restrictedCountry,
    abortController.signal,
    userId,
    ownerTeam.id,
    isFree,
    ownerTeam.allowOveragePayments
  );
  const userMessage = getLastUserMessage(args.messages);
  if (!userMessage) {
    throw new ApiError(400, 'User message not found');
  }

  if (args.useToolsPrompt) {
    const toolUseContext = getToolUseContext(source, modelKey);
    args.messages = [...toolUseContext, ...args.messages];
  }

  // Get the user's preferred AI response language(s)
  const result = AILanguagePreferencesSchema.safeParse(user?.aiLanguages);
  const userAiLanguagePreferences = result.success ? result.data : [];

  if (args.useQuadraticContext) {
    const quadraticContext = getQuadraticContext(source);
    args.messages = [...quadraticContext, ...args.messages];
  }

  // Add AI rules context (team rules + user rules)
  const aiRulesContext = getAIRulesContext(user?.aiRules ?? null, team?.aiRules ?? null);
  if (aiRulesContext.length > 0) {
    args.messages = [...aiRulesContext, ...args.messages];
  }

  // Add AI language preferences context
  if (userAiLanguagePreferences.length > 0) {
    const aiLanguagesContext = getAILanguagesContext(userAiLanguagePreferences);
    args.messages = [...aiLanguagesContext, ...args.messages];
  }

  const parsedResponse = await handleAIRequest({
    modelKey,
    args,
    isOnPaidPlan,
    exceededBillingLimit,
    response: res,
    signal: abortController.signal,
  });
  if (parsedResponse) {
    modelKey = parsedResponse.responseMessage.modelKey as AIModelKey;
    args.messages.push(parsedResponse.responseMessage);

    // Track cost for AI request
    await trackAICost({
      userId,
      teamId: ownerTeam.id,
      fileId,
      usage: parsedResponse.usage,
      modelKey,
      source: toAIChatSource(source),
      isFreePlan: isFree,
      overageEnabled: ownerTeam.allowOveragePayments,
    });
  }

  const model = getModelFromModelKey(modelKey);
  const messageIndex = getLastAIPromptMessageIndex(args.messages) + (parsedResponse ? 0 : 1);

  let chat: AnalyticsAIChat;
  try {
    chat = await dbClient.analyticsAIChat.upsert({
      where: { chatId },
      create: {
        userId,
        fileId,
        chatId,
        source,
        messages: {
          create: {
            model,
            messageIndex,
            messageType,
            source: messageSource,
            inputTokens: parsedResponse?.usage.inputTokens,
            outputTokens: parsedResponse?.usage.outputTokens,
            cacheReadTokens: parsedResponse?.usage.cacheReadTokens,
            cacheWriteTokens: parsedResponse?.usage.cacheWriteTokens,
          },
        },
      },
      update: {
        messages: {
          create: {
            model,
            messageIndex,
            messageType,
            source: messageSource,
            inputTokens: parsedResponse?.usage.inputTokens,
            outputTokens: parsedResponse?.usage.outputTokens,
            cacheReadTokens: parsedResponse?.usage.cacheReadTokens,
            cacheWriteTokens: parsedResponse?.usage.cacheWriteTokens,
          },
        },
        updatedDate: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error in ai.chat.POST handler', error);
    throw new Error('Error in ai.chat.POST handler');
  }

  if (ownerTeam.settingAnalyticsAi) {
    // If we are using s3 and the analytics bucket name is set, save the data
    // This path is also used for self-hosted users, so we don't want to save the data in that case
    if (STORAGE_TYPE === 's3' && getBucketName(S3Bucket.ANALYTICS)) {
      try {
        const key = `${fileUuid}-${source}_${chatId.replace(/-/g, '_')}_${messageIndex}.json`;

        const contents = Buffer.from(JSON.stringify(args)).toString('base64');
        const response = await uploadFile(key, contents, jwt, S3Bucket.ANALYTICS);
        const s3Key = response.key;

        await dbClient.analyticsAIChatMessage.update({
          where: { chatId_messageIndex: { chatId: chat.id, messageIndex } },
          data: { s3Key },
        });
      } catch (error) {
        logger.error('Error in ai.chat.POST handler', error);
      }
    }

    if (['AIAnalyst', 'AIAssistant'].includes(source)) {
      try {
        const interaction = raindrop?.begin({
          userId: userEmail,
          model,
          convoId: chat.chatId,
          event: userMessage.contextType,
          eventId: `${chat.chatId}-${messageIndex}`,
          input:
            userMessage.contextType === 'toolResult'
              ? userMessage.content
                  .map(({ content }) =>
                    content
                      .filter(isContentText)
                      .map((content) => content.text)
                      .join('\n')
                  )
                  .join('\n\n')
              : userMessage.content
                  .filter(isContentText)
                  .map((content) => content.text)
                  .join('\n'),
          properties: {
            tool_results: userMessage.contextType === 'toolResult' ? userMessage.content : [],
          },
        });

        interaction?.finish({
          output:
            parsedResponse?.responseMessage.content
              .filter(isContentText)
              .map((content) => content.text)
              .join('\n') ?? '',
          properties: {
            tool_calls: parsedResponse?.responseMessage.toolCalls ?? [],
            inputTokens: (parsedResponse?.usage.inputTokens ?? 0) + (parsedResponse?.usage.cacheReadTokens ?? 0),
          },
        });
      } catch (error) {
        logger.error('Error in ai.chat.POST handler', error);
      }
    }
  }
}
