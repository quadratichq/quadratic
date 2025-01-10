import type { Response } from 'express';
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
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
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

  console.log('ownerTeam', ownerTeam);

  if (ownerTeam.settingAnalyticsAi) {
    // todo(ayush): upload to s3 / file-storage

    await dbClient.analyticsAIChat.upsert({
      where: {
        chatId,
      },
      create: {
        userId,
        fileId,
        chatId,
        source,
        s3Key: '',
      },
      update: {
        s3Key: '',
        updatedDate: new Date(),
      },
    });
  }
}
