import type { Response } from 'express';
import { getLastAIPromptMessageIndex, getLastPromptMessageType } from 'quadratic-shared/ai/helpers/message.helper';
import { getModelFromModelKey } from 'quadratic-shared/ai/helpers/model.helper';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { handleAIRequest } from '../../ai/handler/ai.handler';
import { getModelKey } from '../../ai/helpers/modelRouter.helper';
import { ai_rate_limiter } from '../../ai/middleware/aiRateLimiter';
import dbClient from '../../dbClient';
import { STORAGE_TYPE } from '../../env-vars';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { getBucketName, S3Bucket } from '../../storage/s3';
import { uploadFile } from '../../storage/storage';
import type { RequestWithUser } from '../../types/Request';

export default [validateAccessToken, ai_rate_limiter, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/ai/chat.POST.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/ai/chat.POST.response']>) {
  const {
    user: { id: userId },
  } = req;

  // const usage = await BillingAIUsageMonthlyForUser(userId);
  // const exceededBillingLimit = BillingAIUsageLimitExceeded(usage);

  // if (exceededBillingLimit) {
  //   //@ts-expect-error
  //   return res.status(402).json({ error: 'Billing limit exceeded' });
  // }

  const { body } = parseRequest(req, schema);
  const { chatId, fileUuid, modelKey: clientModelKey, ...args } = body;

  const source = args.source;
  const modelKey = await getModelKey(clientModelKey, args);

  const parsedResponse = await handleAIRequest(modelKey, args, res);
  if (parsedResponse) {
    args.messages.push(parsedResponse.responseMessage);
  }

  const {
    file: { id: fileId, ownerTeam },
  } = await getFile({ uuid: fileUuid, userId });

  const model = getModelFromModelKey(modelKey);
  const messageIndex = getLastAIPromptMessageIndex(args.messages) + (parsedResponse ? 0 : 1);
  const messageType = getLastPromptMessageType(args.messages);

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
  } catch (e) {
    console.error(e);
  }
}
