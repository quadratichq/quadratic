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
import { EmptyMessagesError } from '../helpers/errors';
import { createFileForFineTuning } from '../helpers/fineTuning.helper';
import { calculateUsage } from '../helpers/usage.helper';
import {
  anthropic,
  azureOpenAI,
  baseten,
  bedrock,
  bedrockAnthropic,
  fireworks,
  geminiai,
  openai,
  openRouter,
  vertexai,
  vertexAnthropic,
  xai,
} from '../providers';
import { handleAnthropicRequest } from './anthropic.handler';
import { handleBedrockRequest } from './bedrock.handler';
import { handleGenAIRequest } from './genai.handler';
import { handleOpenAIChatCompletionsRequest } from './openai.chatCompletions.handler';
import { handleOpenAIResponsesRequest } from './openai.responses.handler';

export interface HandleAIRequestArgs {
  modelKey: AIModelKey;
  args: AIRequestHelperArgs;
  isOnPaidPlan: boolean;
  exceededBillingLimit: boolean;
  response?: Response;
  signal?: AbortSignal;
}

/**
 * Detect if an error is related to the prompt being too long / exceeding context window.
 * Different AI providers return this error in different formats:
 * - Anthropic: status 413, or 400 with message "Prompt is too long"
 * - OpenAI: status 400 with code "context_length_exceeded"
 * - Google/Vertex: various message patterns
 * - Bedrock: wrapped errors with similar patterns
 */
function isPromptTooLongError(error: unknown): boolean {
  if (!error) return false;

  const errorObj = error as Record<string, unknown>;

  // Check for HTTP 413 status (Request Entity Too Large)
  if (errorObj.status === 413 || errorObj.statusCode === 413) {
    return true;
  }

  // OpenAI uses 'code' field for specific error types
  if (errorObj.code === 'context_length_exceeded') {
    return true;
  }

  // Anthropic/others use 'type' field
  if (errorObj.type === 'request_too_large') {
    return true;
  }

  // Check nested error structure (some SDKs wrap errors)
  const nestedError = errorObj.error as Record<string, unknown> | undefined;
  if (nestedError) {
    const nestedType = nestedError.type;
    const nestedMessage = String(nestedError.message ?? '').toLowerCase();

    if (nestedType === 'request_too_large') {
      return true;
    }

    if (nestedType === 'invalid_request_error' && nestedMessage.includes('prompt is too long')) {
      return true;
    }
  }

  // Fallback: check error message for common patterns (less reliable but catches edge cases)
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const contextPatterns = [
    'prompt is too long',
    'context_length_exceeded',
    'maximum context length',
    'too many tokens',
  ];

  return contextPatterns.some((pattern) => errorMessage.includes(pattern));
}

export const handleAIRequest = async ({
  modelKey,
  args,
  isOnPaidPlan,
  exceededBillingLimit,
  response,
  signal,
}: HandleAIRequestArgs): Promise<ParsedAIResponse | undefined> => {
  try {
    let parsedResponse: ParsedAIResponse | undefined;

    if (isVertexAIAnthropicModel(modelKey)) {
      parsedResponse = await handleAnthropicRequest({
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        response,
        signal,
        anthropic: vertexAnthropic,
      });
    } else if (isBedrockAnthropicModel(modelKey)) {
      parsedResponse = await handleAnthropicRequest({
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        response,
        signal,
        anthropic: bedrockAnthropic,
      });
    } else if (isAnthropicModel(modelKey)) {
      parsedResponse = await handleAnthropicRequest({
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        response,
        signal,
        anthropic,
      });
    } else if (isOpenAIModel(modelKey)) {
      parsedResponse = await handleOpenAIResponsesRequest({
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        response,
        signal,
        openai,
      });
    } else if (isAzureOpenAIModel(modelKey)) {
      parsedResponse = await handleOpenAIResponsesRequest({
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        response,
        signal,
        openai: azureOpenAI,
      });
    } else if (isXAIModel(modelKey)) {
      parsedResponse = await handleOpenAIChatCompletionsRequest({
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        response,
        signal,
        openai: xai,
      });
    } else if (isBasetenModel(modelKey)) {
      parsedResponse = await handleOpenAIChatCompletionsRequest({
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        response,
        signal,
        openai: baseten,
      });
    } else if (isFireworksModel(modelKey)) {
      parsedResponse = await handleOpenAIChatCompletionsRequest({
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        response,
        signal,
        openai: fireworks,
      });
    } else if (isOpenRouterModel(modelKey)) {
      parsedResponse = await handleOpenAIChatCompletionsRequest({
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        response,
        signal,
        openai: openRouter,
      });
    } else if (isVertexAIModel(modelKey)) {
      parsedResponse = await handleGenAIRequest({
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        response,
        signal,
        genai: vertexai,
      });
    } else if (isGenAIModel(modelKey)) {
      parsedResponse = await handleGenAIRequest({
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        response,

        genai: geminiai,
      });
    } else if (isBedrockModel(modelKey)) {
      parsedResponse = await handleBedrockRequest({
        modelKey,
        args,
        isOnPaidPlan,
        exceededBillingLimit,
        response,
        signal,
        bedrock,
      });
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

    // Empty messages after filtering - not retryable with a different model
    if (error instanceof EmptyMessagesError) {
      logger.warn(`[handleAIRequest] ${error.message} (model: ${modelKey}, source: ${args.source})`);

      const responseMessage: ApiTypes['/v0/ai/chat.POST.response'] = {
        role: 'assistant',
        content: [createTextContent('Something went wrong with the conversation. Please try sending your message again.')],
        contextType: 'userPrompt',
        toolCalls: [],
        modelKey,
        isOnPaidPlan,
        exceededBillingLimit,
        error: true,
        errorType: 'general',
      };
      const options = getModelOptions(modelKey, args);
      if (options.stream) {
        if (!response?.headersSent) {
          response?.setHeader('Content-Type', 'text/event-stream');
          response?.setHeader('Cache-Control', 'no-cache');
          response?.setHeader('Connection', 'keep-alive');
        }
        response?.write(`data: ${JSON.stringify(responseMessage)}\n\n`);
        response?.end();
      } else {
        response?.json(responseMessage);
      }
      return;
    }

    // Check if this is a context length / prompt too long error
    // These are expected user errors - log at info/warning level, not error
    const isContextLengthError = isPromptTooLongError(error);

    if (isContextLengthError) {
      // Don't capture to Sentry yet - wait to see if backup model succeeds
      logger.info(`[handleAIRequest] Prompt too long for model ${modelKey}, will try backup if available`);
    } else {
      logger.error(`[handleAIRequest] Error in handleAIRequest ${modelKey}`, error);
      Sentry.captureException(error, {
        level: 'error',
        extra: {
          context: 'Error in handleAIRequest',
          modelKey,
        },
      });
    }

    // Try backup model in production - backup may have larger context window
    if (ENVIRONMENT === 'production' && ['AIAnalyst', 'AIAssistant'].includes(args.source)) {
      const options = getModelOptions(modelKey, args);

      // Prefer a model-specific backup when provided; otherwise use the global defaults
      const configuredBackup = MODELS_CONFIGURATION[modelKey].backupModelKey;
      const fallbackDefault = options.thinking ? DEFAULT_BACKUP_MODEL_THINKING : DEFAULT_BACKUP_MODEL;
      const backupModelKey = configuredBackup ?? fallbackDefault;

      if (modelKey !== backupModelKey) {
        return handleAIRequest({
          modelKey: backupModelKey,
          args,
          isOnPaidPlan,
          exceededBillingLimit,
          response,
          signal,
        });
      }
    }

    // If we reach here with a context length error, backup also failed or wasn't available
    if (isContextLengthError) {
      Sentry.captureException(error, {
        level: 'warning',
        extra: {
          context: 'Prompt too long - all models exhausted',
          modelKey,
        },
      });
    }

    // Create user-friendly error message
    const userErrorMessage = isContextLengthError
      ? "Your conversation is too long for the AI model's context window."
      : error instanceof Error
        ? error.message
        : 'An unexpected error occurred. Please try again.';

    const responseMessage: ApiTypes['/v0/ai/chat.POST.response'] = {
      role: 'assistant',
      content: [createTextContent(userErrorMessage)],
      contextType: 'userPrompt',
      toolCalls: [],
      modelKey,
      isOnPaidPlan,
      exceededBillingLimit,
      error: true,
      errorType: isContextLengthError ? 'context_length' : 'general',
    };
    const options = getModelOptions(modelKey, args);
    // Send response in the format the client expects based on model streaming config
    if (options.stream) {
      // If headers not sent yet, set them for SSE
      if (!response?.headersSent) {
        response?.setHeader('Content-Type', 'text/event-stream');
        response?.setHeader('Cache-Control', 'no-cache');
        response?.setHeader('Connection', 'keep-alive');
      }
      response?.write(`data: ${JSON.stringify(responseMessage)}\n\n`);
      response?.end();
    } else {
      response?.json(responseMessage);
    }
  }
};
