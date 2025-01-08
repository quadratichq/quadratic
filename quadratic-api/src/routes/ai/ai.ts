import express, { type Response } from 'express';
import {
  isAnthropicModel,
  isBedrockAnthropicModel,
  isBedrockModel,
  isOpenAIModel,
} from 'quadratic-shared/ai/helpers/model.helper';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { AIAutoCompleteRequestBodySchema, type AIMessagePrompt } from 'quadratic-shared/typesAndSchemasAI';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import type { Request } from '../../types/Request';
import { ai_rate_limiter } from './aiRateLimiter';
import { handleAnthropicRequest } from './anthropic';
import { handleBedrockRequest } from './bedrock';
import { getQuadraticContext, getToolUseContext } from './helpers/context.helper';
import { handleOpenAIRequest } from './openai';

const ai_router = express.Router();

ai_router.post('/', validateAccessToken, ai_rate_limiter, async (request: Request, response: Response) => {
  try {
    const body = AIAutoCompleteRequestBodySchema.parse(request.body);
    const { model, ...args } = body;

    if (args.useToolUsePrompt) {
      const toolUseContext = getToolUseContext();
      args.messages.unshift(...toolUseContext);
    }

    if (args.useQuadraticContext) {
      const quadraticContext = getQuadraticContext(args.language);
      args.messages.unshift(...quadraticContext);
    }

    let responseMessage: AIMessagePrompt | undefined;
    if (isBedrockAnthropicModel(model) || isBedrockModel(model)) {
      responseMessage = await handleBedrockRequest(model, args, response);
    } else if (isAnthropicModel(model)) {
      responseMessage = await handleAnthropicRequest(model, args, response);
    } else if (isOpenAIModel(model)) {
      responseMessage = await handleOpenAIRequest(model, args, response);
    } else {
      throw new Error(`Model not supported: ${model}`);
    }

    if (responseMessage) {
      args.messages.push(responseMessage);
    }

    // todo(ayush): check for permission and then log chats
    console.log(args.chatId);
    console.log(args.source);
    console.log(args.messages);
  } catch (error: any) {
    response.status(400).json(error);
    console.log(error);
  }
});

ai_router.post('/feedback', validateAccessToken, async (request: Request, response: Response) => {
  const body = ApiSchemas['/ai/feedback.POST.request'].parse(request.body);
  console.log(body);
  response.status(200).json({ message: 'Feedback received' });
});

export default ai_router;
