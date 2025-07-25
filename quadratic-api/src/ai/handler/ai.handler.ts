import * as Sentry from '@sentry/node';
import type { Response } from 'express';
import {
  getModelOptions,
  isAnthropicModel,
  isAzureOpenAIModel,
  isBasetenModel,
  isBedrockAnthropicModel,
  isBedrockModel,
  isGenAIModel,
  isOpenAIModel,
  isOpenRouterModel,
  isVertexAIAnthropicModel,
  isVertexAIModel,
  isXAIModel,
} from 'quadratic-shared/ai/helpers/model.helper';
import { DEFAULT_BACKUP_MODEL, DEFAULT_BACKUP_MODEL_THINKING } from 'quadratic-shared/ai/models/AI_MODELS';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import type { AIModelKey, AIRequestHelperArgs, ParsedAIResponse } from 'quadratic-shared/typesAndSchemasAI';
import { handleAnthropicRequest } from '../../ai/handler/anthropic.handler';
import { handleBedrockRequest } from '../../ai/handler/bedrock.handler';
import { handleOpenAIRequest } from '../../ai/handler/openai.handler';
import {
  anthropic,
  azureOpenAI,
  baseten,
  bedrock,
  bedrock_anthropic,
  geminiai,
  open_router,
  openai,
  vertex_anthropic,
  vertexai,
  xai,
} from '../../ai/providers';
import { debugAndNotInProduction, ENVIRONMENT, FINE_TUNE } from '../../env-vars';
import { createFileForFineTuning } from '../helpers/fineTuning.helper';
import { calculateUsage } from '../helpers/usage.helper';
import { handleGenAIRequest } from './genai.handler';

export const handleAIRequest = async (
  modelKey: AIModelKey,
  args: AIRequestHelperArgs,
  isOnPaidPlan: boolean,
  exceededBillingLimit: boolean,
  response?: Response
): Promise<ParsedAIResponse | undefined> => {
  try {
    let parsedResponse: ParsedAIResponse | undefined;

    if (isVertexAIAnthropicModel(modelKey)) {
      parsedResponse = await handleAnthropicRequest(
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        vertex_anthropic,
        response
      );
    } else if (isBedrockAnthropicModel(modelKey)) {
      parsedResponse = await handleAnthropicRequest(
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        bedrock_anthropic,
        response
      );
    } else if (isAnthropicModel(modelKey)) {
      parsedResponse = await handleAnthropicRequest(
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        anthropic,
        response
      );
    } else if (isOpenAIModel(modelKey)) {
      parsedResponse = await handleOpenAIRequest(modelKey, args, isOnPaidPlan, exceededBillingLimit, openai, response);
    } else if (isAzureOpenAIModel(modelKey)) {
      parsedResponse = await handleOpenAIRequest(
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        azureOpenAI,
        response
      );
    } else if (isXAIModel(modelKey)) {
      parsedResponse = await handleOpenAIRequest(modelKey, args, isOnPaidPlan, exceededBillingLimit, xai, response);
    } else if (isBasetenModel(modelKey)) {
      parsedResponse = await handleOpenAIRequest(modelKey, args, isOnPaidPlan, exceededBillingLimit, baseten, response);
    } else if (isOpenRouterModel(modelKey)) {
      parsedResponse = await handleOpenAIRequest(
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        open_router,
        response
      );
    } else if (isVertexAIModel(modelKey)) {
      parsedResponse = await handleGenAIRequest(modelKey, args, isOnPaidPlan, exceededBillingLimit, vertexai, response);
    } else if (isGenAIModel(modelKey)) {
      parsedResponse = await handleGenAIRequest(modelKey, args, isOnPaidPlan, exceededBillingLimit, geminiai, response);
    } else if (isBedrockModel(modelKey)) {
      parsedResponse = await handleBedrockRequest(
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        bedrock,
        response
      );
    } else {
      throw new Error(`Model not supported: ${modelKey}`);
    }

    if (debugAndNotInProduction && !!parsedResponse) {
      parsedResponse.usage.source = args.source;
      parsedResponse.usage.modelKey = modelKey;
      parsedResponse.usage.cost = calculateUsage(parsedResponse.usage);
      console.log(JSON.stringify({ message: 'AI.Usage', usage: parsedResponse.usage }));
    }

    if (debugAndNotInProduction && FINE_TUNE === 'true' && !!parsedResponse) {
      createFileForFineTuning(modelKey, args, parsedResponse);
    }

    return parsedResponse;
  } catch (error) {
    console.error(JSON.stringify({ message: 'Error in handleAIRequest', modelKey, error }));

    Sentry.captureException(error, {
      level: 'error',
      extra: {
        context: 'Error in handleAIRequest',
        modelKey,
      },
    });

    if (ENVIRONMENT === 'production' && ['AIAnalyst', 'AIAssistant'].includes(args.source)) {
      const options = getModelOptions(modelKey, args);

      // thinking backup model
      if (options.thinking && modelKey !== DEFAULT_BACKUP_MODEL_THINKING) {
        return handleAIRequest(DEFAULT_BACKUP_MODEL_THINKING, args, isOnPaidPlan, exceededBillingLimit, response);
      }
      // non-thinking backup model
      else if (!options.thinking && modelKey !== DEFAULT_BACKUP_MODEL) {
        return handleAIRequest(DEFAULT_BACKUP_MODEL, args, isOnPaidPlan, exceededBillingLimit, response);
      }
    }

    const responseMessage: ApiTypes['/v0/ai/chat.POST.response'] = {
      role: 'assistant',
      content: [{ type: 'text', text: JSON.stringify(error) }],
      contextType: 'userPrompt',
      toolCalls: [],
      modelKey,
      isOnPaidPlan,
      exceededBillingLimit,
      error: true,
    };
    const options = getModelOptions(modelKey, args);
    if (!options.stream || !response?.headersSent) {
      response?.json(responseMessage);
    } else {
      response?.write(`data: ${JSON.stringify(responseMessage)}\n\n`);
      response?.end();
    }
  }
};
