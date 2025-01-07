import express, { type Response } from 'express';
import {
  isAnthropicBedrockModel,
  isAnthropicModel,
  isBedrockModel,
  isOpenAIModel,
} from 'quadratic-shared/ai/model.helper';
import { AIAutoCompleteRequestBodySchema } from 'quadratic-shared/typesAndSchemasAI';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import type { Request } from '../../types/Request';
import { ai_rate_limiter } from './aiRateLimiter';
import { handleAnthropicRequest } from './anthropic';
import { handleBedrockRequest } from './bedrock';
import { handleOpenAIRequest } from './openai';

const ai_router = express.Router();

ai_router.post('/', validateAccessToken, ai_rate_limiter, async (request: Request, response: Response) => {
  try {
    const { model, ...args } = AIAutoCompleteRequestBodySchema.parse(request.body);

    switch (true) {
      case isAnthropicBedrockModel(model) || isBedrockModel(model):
        return handleBedrockRequest(model, args, response);
      case isAnthropicModel(model):
        return handleAnthropicRequest(model, args, response);
      case isOpenAIModel(model):
        return handleOpenAIRequest(model, args, response);
      default:
        throw new Error('Model not supported');
    }
  } catch (error: any) {
    response.status(400).json(error);
    console.log(error);
  }
});

export default ai_router;
