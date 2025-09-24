import * as Sentry from '@sentry/node';
import type { Response } from 'express';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import {
  getModelOptions,
  isAnthropicModel,
  isAzureOpenAIModel,
  isBasetenModel,
  isBedrockAnthropicModel,
  isBedrockModel,
  isFireworksModel,
  isGenAIModel,
  isOpenAIModel,
  isOpenRouterModel,
  isVertexAIAnthropicModel,
  isVertexAIModel,
  isXAIModel,
} from 'quadratic-shared/ai/helpers/model.helper';
import {
  DEFAULT_BACKUP_MODEL,
  DEFAULT_BACKUP_MODEL_THINKING,
  MODELS_CONFIGURATION,
} from 'quadratic-shared/ai/models/AI_MODELS';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import type { AIModelKey, AIRequestHelperArgs, ParsedAIResponse } from 'quadratic-shared/typesAndSchemasAI';
import { debugAndNotInProduction, ENVIRONMENT, FINE_TUNE } from '../../env-vars';
import logger from '../../utils/logger';
import { createFileForFineTuning } from '../helpers/fineTuning.helper';
import { calculateUsage } from '../helpers/usage.helper';
import {
  anthropic,
  azureOpenAI,
  baseten,
  bedrock,
  bedrock_anthropic,
  fireworks,
  geminiai,
  open_router,
  openai,
  vertex_anthropic,
  vertexai,
  xai,
} from '../providers';
import { handleAnthropicRequest } from './anthropic.handler';
import { handleBedrockRequest } from './bedrock.handler';
import { handleGenAIRequest } from './genai.handler';
import { handleOpenAIChatCompletionsRequest } from './openai.chatCompletions.handler';
import { handleOpenAIResponsesRequest } from './openai.responses.handler';

export const handleAIRequest = async (
  modelKey: AIModelKey,
  args: AIRequestHelperArgs,
  isOnPaidPlan: boolean,
  exceededBillingLimit: boolean,
  response?: Response,
  signal?: AbortSignal
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
        response,
        signal
      );
    } else if (isBedrockAnthropicModel(modelKey)) {
      parsedResponse = await handleAnthropicRequest(
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        bedrock_anthropic,
        response,
        signal
      );
    } else if (isAnthropicModel(modelKey)) {
      parsedResponse = await handleAnthropicRequest(
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        anthropic,
        response,
        signal
      );
    } else if (isOpenAIModel(modelKey)) {
      parsedResponse = await handleOpenAIResponsesRequest(
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        openai,
        response,
        signal
      );
    } else if (isAzureOpenAIModel(modelKey)) {
      parsedResponse = await handleOpenAIChatCompletionsRequest(
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        azureOpenAI,
        response,
        signal
      );
    } else if (isXAIModel(modelKey)) {
      parsedResponse = await handleOpenAIChatCompletionsRequest(
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        xai,
        response,
        signal
      );
    } else if (isBasetenModel(modelKey)) {
      parsedResponse = await handleOpenAIChatCompletionsRequest(
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        baseten,
        response,
        signal
      );
    } else if (isFireworksModel(modelKey)) {
      parsedResponse = await handleOpenAIChatCompletionsRequest(
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        fireworks,
        response,
        signal
      );
    } else if (isOpenRouterModel(modelKey)) {
      parsedResponse = await handleOpenAIChatCompletionsRequest(
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        open_router,
        response,
        signal
      );
    } else if (isVertexAIModel(modelKey)) {
      parsedResponse = await handleGenAIRequest(
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        vertexai,
        response,
        signal
      );
    } else if (isGenAIModel(modelKey)) {
      parsedResponse = await handleGenAIRequest(
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        geminiai,
        response,
        signal
      );
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
      logger.info('AI.Usage', { usage: parsedResponse.usage });
    }

    if (debugAndNotInProduction && FINE_TUNE === 'true' && !!parsedResponse) {
      createFileForFineTuning(modelKey, args, parsedResponse);
    }

    return parsedResponse;
  } catch (error) {
    if (signal?.aborted) {
      logger.info(`[handleAIRequest] AI request aborted by client`);
      return;
    }

    logger.error(`[handleAIRequest] Error in handleAIRequest ${modelKey}`, error);

    Sentry.captureException(error, {
      level: 'error',
      extra: {
        context: 'Error in handleAIRequest',
        modelKey,
      },
    });

    if (ENVIRONMENT === 'production' && ['AIAnalyst', 'AIAssistant'].includes(args.source)) {
      const options = getModelOptions(modelKey, args);

      const backupModelKey = options.thinking
        ? DEFAULT_BACKUP_MODEL_THINKING
        : (MODELS_CONFIGURATION[modelKey].backupModelKey ?? DEFAULT_BACKUP_MODEL);

      if (modelKey !== backupModelKey) {
        return handleAIRequest(backupModelKey, args, isOnPaidPlan, exceededBillingLimit, response, signal);
      }
    }

    const responseMessage: ApiTypes['/v0/ai/chat.POST.response'] = {
      role: 'assistant',
      content: [
        createTextContent(
          JSON.stringify(
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                  stack: error.stack,
                }
              : error
          )
        ),
      ],
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
