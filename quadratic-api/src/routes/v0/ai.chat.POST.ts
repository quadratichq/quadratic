import type { Response } from 'express';
import { getLastUserPromptMessageIndex } from 'quadratic-shared/ai/helpers/message.helper';
import {
  isAnthropicModel,
  isBedrockAnthropicModel,
  isBedrockModel,
  isOpenAIModel,
} from 'quadratic-shared/ai/helpers/model.helper';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { type AIMessagePrompt } from 'quadratic-shared/typesAndSchemasAI';
import { z } from 'zod';
import { handleAnthropicRequest } from '../../ai/handler/anthropic';
import { handleBedrockRequest } from '../../ai/handler/bedrock';
import { handleOpenAIRequest } from '../../ai/handler/openai';
import { getQuadraticContext, getToolUseContext } from '../../ai/helpers/context.helper';
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

  const { body } = parseRequest(req, schema);
  const { chatId, fileUuid, source, model, ...args } = body;

  if (args.useToolsPrompt) {
    const toolUseContext = getToolUseContext();
    args.messages.unshift(...toolUseContext);
  }

  if (args.useQuadraticContext) {
    const quadraticContext = getQuadraticContext(args.language);
    args.messages.unshift(...quadraticContext);
  }

  let responseMessage: AIMessagePrompt | undefined;
  if (isBedrockAnthropicModel(model) || isBedrockModel(model)) {
    responseMessage = await handleBedrockRequest(model, args, res);
  } else if (isAnthropicModel(model)) {
    responseMessage = await handleAnthropicRequest(model, args, res);
  } else if (isOpenAIModel(model)) {
    responseMessage = await handleOpenAIRequest(model, args, res);
  } else {
    throw new Error(`Model not supported: ${model}`);
  }

  if (responseMessage) {
    args.messages.push(responseMessage);
  }

  const {
    file: { id: fileId, ownerTeam },
  } = await getFile({ uuid: fileUuid, userId });

  const messageIndex = getLastUserPromptMessageIndex(args.messages);

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
        },
      },
    },
    update: {
      messages: {
        create: {
          model,
          messageIndex,
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
