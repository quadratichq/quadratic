import express, { type Response } from 'express';
import {
  isAnthropicModel,
  isBedrockAnthropicModel,
  isBedrockModel,
  isOpenAIModel,
} from 'quadratic-shared/ai/helpers/model.helper';
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
    const { model, ...args } = AIAutoCompleteRequestBodySchema.parse(request.body);

    if (args.useToolUsePrompt) {
      const toolUseContext = getToolUseContext();
      args.messages.unshift(...toolUseContext);
    }

    if (args.useQuadraticContext) {
      const quadraticContext = getQuadraticContext(args.language);
      args.messages.unshift(...quadraticContext);
    }

    let responseMessage: AIMessagePrompt | undefined;

    switch (true) {
      case isBedrockAnthropicModel(model) || isBedrockModel(model):
        responseMessage = await handleBedrockRequest(model, args, response);
        break;
      case isAnthropicModel(model):
        responseMessage = await handleAnthropicRequest(model, args, response);
        break;
      case isOpenAIModel(model):
        responseMessage = await handleOpenAIRequest(model, args, response);
        break;
      default:
        throw new Error('Model not supported');
    }

    if (responseMessage) {
      args.messages.push(responseMessage);
    }

    // todo(ayush): check for permission and then log chats
    console.log(args.messages);
  } catch (error: any) {
    response.status(400).json(error);
    console.log(error);
  }
});

export default ai_router;
