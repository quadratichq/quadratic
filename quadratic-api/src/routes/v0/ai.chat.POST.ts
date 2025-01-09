import type { Response } from 'express';
import { handleAnthropicRequest } from 'quadratic-api/src/ai/handler/anthropic';
import { handleBedrockRequest } from 'quadratic-api/src/ai/handler/bedrock';
import { handleOpenAIRequest } from 'quadratic-api/src/ai/handler/openai';
import { getQuadraticContext, getToolUseContext } from 'quadratic-api/src/ai/helpers/context.helper';
import { ai_rate_limiter } from 'quadratic-api/src/ai/middleware/aiRateLimiter';
import { userMiddleware } from 'quadratic-api/src/middleware/user';
import { validateAccessToken } from 'quadratic-api/src/middleware/validateAccessToken';
import { parseRequest } from 'quadratic-api/src/middleware/validateRequestSchema';
import type { RequestWithUser } from 'quadratic-api/src/types/Request';
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

export default [validateAccessToken, ai_rate_limiter, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/ai/chat.POST.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/ai/chat.POST.response']>) {
  const {
    user: { id: userId },
  } = req;

  const { body } = parseRequest(req, schema);
  const { model, ...args } = body;

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

  // todo(ayush): check for permission and then log chats
  console.log(userId);
  console.log(args.chatId);
  console.log(args.fileUuid);
  console.log(args.source);
}
