import type { Response } from 'express';
import { getLastAIPromptMessageIndex, getLastUserMessageType } from 'quadratic-shared/ai/helpers/message.helper';
import { getModelFromModelKey, getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { convertError } from 'quadratic-shared/utils/error';
import { z } from 'zod';
import { handleAIRequest } from '../../ai/handler/ai.handler';
import { getQuadraticContext, getToolUseContext } from '../../ai/helpers/context.helper';
import { getModelKey } from '../../ai/helpers/modelRouter.helper';
import { ai_rate_limiter } from '../../ai/middleware/aiRateLimiter';
import { BillingAIUsageLimitExceeded, BillingAIUsageMonthlyForUserInTeam } from '../../billing/AIUsageHelpers';
import dbClient from '../../dbClient';
import { STORAGE_TYPE } from '../../env-vars';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { getBucketName, S3Bucket } from '../../storage/s3';
import { uploadFile } from '../../storage/storage';
import type { RequestWithUser } from '../../types/Request';
import { getIsOnPaidPlan } from '../../utils/billing';

export default [validateAccessToken, ai_rate_limiter, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/ai/chat.POST.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/ai/chat.POST.response']>) {
  const {
    user: { id: userId },
  } = req;

  const { body } = parseRequest(req, schema);
  const { chatId, fileUuid, messageSource, modelKey: clientModelKey, ...args } = body;

  const {
    file: { id: fileId, ownerTeam },
  } = await getFile({ uuid: fileUuid, userId });

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

  // Either team is not on a paid plan or user is not a member of the team
  // and the message is a user prompt, not a tool result
  if ((!isOnPaidPlan || !userTeamRole) && messageType === 'userPrompt') {
    const usage = await BillingAIUsageMonthlyForUserInTeam(userId, ownerTeam.id);
    exceededBillingLimit = BillingAIUsageLimitExceeded(usage);

    if (exceededBillingLimit) {
      const responseMessage: ApiTypes['/v0/ai/chat.POST.response'] = {
        role: 'assistant',
        content: [],
        contextType: 'userPrompt',
        toolCalls: [],
        modelKey: clientModelKey,
        isOnPaidPlan,
        exceededBillingLimit,
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

  const source = args.source;
  const modelKey = await getModelKey(clientModelKey, args, isOnPaidPlan, exceededBillingLimit);

  if (args.useToolsPrompt) {
    const toolUseContext = getToolUseContext(args.source, modelKey);
    args.messages = [...toolUseContext, ...args.messages];
  }

  if (args.useQuadraticContext) {
    const quadraticContext = getQuadraticContext(args.language);
    args.messages = [...quadraticContext, ...args.messages];
  }

  const parsedResponse = await handleAIRequest(modelKey, args, isOnPaidPlan, exceededBillingLimit, res);
  if (parsedResponse) {
    args.messages.push(parsedResponse.responseMessage);
  }

  const model = getModelFromModelKey(modelKey);
  const messageIndex = getLastAIPromptMessageIndex(args.messages) + (parsedResponse ? 0 : 1);

  const chat = await dbClient.analyticsAIChat.upsert({
    where: {
      chatId,
    },
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

  // Save the data to s3
  try {
    if (ownerTeam.settingAnalyticsAi) {
      const key = `${fileUuid}-${source}_${chatId.replace(/-/g, '_')}_${messageIndex}.json`;

      // If we aren't using s3 or the analytics bucket name is not set, don't save the data
      // This path is also used for self-hosted users, so we don't want to save the data in that case
      if (STORAGE_TYPE !== 's3' || !getBucketName(S3Bucket.ANALYTICS)) {
        return;
      }

      const jwt = req.header('Authorization');
      if (!jwt) {
        return;
      }

      const contents = Buffer.from(JSON.stringify(args)).toString('base64');
      const response = await uploadFile(key, contents, jwt, S3Bucket.ANALYTICS);
      const s3Key = response.key;

      await dbClient.analyticsAIChatMessage.update({
        where: {
          chatId_messageIndex: { chatId: chat.id, messageIndex },
        },
        data: { s3Key },
      });
    }
  } catch (error) {
    console.error(JSON.stringify({ message: 'Error in ai.chat.POST handler', error: convertError(error) }));
  }
}
