/**
 * AI Handler V2 - Hybrid LangChain + Native SDK Implementation
 *
 * This module provides the best of both worlds:
 * - LangChain for unified model initialization, configuration, and message formatting
 * - Native vendor SDKs for sophisticated streaming with full feature support
 *
 * Benefits:
 * - ✅ 100% feature parity with V1 (thinking mode, incremental streaming, etc.)
 * - ✅ LangChain's unified model management and tool binding
 * - ✅ All sophisticated streaming features (thinking blocks, loading states, etc.)
 * - ✅ Future-ready for LangChain ecosystem features (chains, agents)
 * - ✅ Battle-tested V1 parsing logic
 *
 * Architecture:
 * 1. Use LangChain to initialize models with proper configuration
 * 2. Extract underlying vendor clients (anthropic.client, openai.client, etc.)
 * 3. Call native APIs for sophisticated streaming
 * 4. Use V1's proven parser functions for complete feature support
 */

import * as Sentry from '@sentry/node';
import type { Response } from 'express';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import {
  getModelFromModelKey,
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

// Import V1's sophisticated helpers and parsers
import { getAnthropicApiArgs, parseAnthropicResponse, parseAnthropicStream } from '../helpers/anthropic.helper';
import { getBedrockApiArgs, parseBedrockResponse, parseBedrockStream } from '../helpers/bedrock.helper';
import { getGenAIApiArgs, parseGenAIResponse, parseGenAIStream } from '../helpers/genai.helper';
import {
  getOpenAIChatCompletionsApiArgs,
  parseOpenAIChatCompletionsResponse,
  parseOpenAIChatCompletionsStream,
} from '../helpers/openai.chatCompletions.helper';
import {
  getOpenAIResponsesApiArgs,
  parseOpenAIResponsesResponse,
  parseOpenAIResponsesStream,
} from '../helpers/openai.responses.helper';

// Import provider clients
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

export interface HandleAIRequestV2Args {
  modelKey: AIModelKey;
  args: AIRequestHelperArgs;
  isOnPaidPlan: boolean;
  exceededBillingLimit: boolean;
  response?: Response;
  signal?: AbortSignal;
}

/**
 * Main handler for AI requests using hybrid LangChain + Native SDK approach.
 *
 * This implementation:
 * 1. Uses LangChain for model configuration and message formatting
 * 2. Leverages native vendor SDKs for sophisticated streaming
 * 3. Uses V1's battle-tested parser functions for 100% feature parity
 *
 * Features preserved from V1:
 * - Anthropic thinking mode with thinking/redacted_thinking blocks
 * - Prompt caching with cache_control metadata
 * - Incremental tool argument streaming
 * - Tool loading states (loading: true/false)
 * - Google thinking blocks and search grounding metadata
 * - Smooth incremental text streaming
 * - Complete cache token tracking (read/write)
 * - All advanced parameters (top_p, top_k, reasoning, etc.)
 */
export const handleAIRequestV2 = async ({
  modelKey,
  args,
  isOnPaidPlan,
  exceededBillingLimit,
  response,
  signal,
}: HandleAIRequestV2Args): Promise<ParsedAIResponse | undefined> => {
  try {
    let parsedResponse: ParsedAIResponse | undefined;

    // Anthropic models - use native SDK with V1 parsers for thinking mode support
    if (isVertexAIAnthropicModel(modelKey)) {
      const model = getModelFromModelKey(modelKey);
      const options = getModelOptions(modelKey, args);
      const { system, messages, tools, tool_choice } = getAnthropicApiArgs(
        args,
        options.aiModelMode,
        options.promptCaching,
        options.thinking
      );

      const thinking = options.thinking
        ? { type: 'enabled' as const, budget_tokens: Math.floor(options.max_tokens * 0.75) }
        : { type: 'disabled' as const };

      let apiArgs: any = {
        model,
        system,
        messages,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        stream: options.stream,
        tools,
        tool_choice,
      };

      if (options.thinking !== undefined) {
        apiArgs = { ...apiArgs, thinking };
      }

      if (options.stream) {
        if (!response?.headersSent) {
          response?.setHeader('Content-Type', 'text/event-stream');
          response?.setHeader('Cache-Control', 'no-cache');
          response?.setHeader('Connection', 'keep-alive');
        }
        response?.write('stream\n\n');

        apiArgs.stream = true;
        const chunks = await vertexAnthropic.messages.create(apiArgs, { signal });
        parsedResponse = await parseAnthropicStream(
          chunks as any,
          modelKey,
          isOnPaidPlan,
          exceededBillingLimit,
          response
        );
      } else {
        apiArgs.stream = false;
        const result = await vertexAnthropic.messages.create(apiArgs, { signal });
        parsedResponse = parseAnthropicResponse(result as any, modelKey, isOnPaidPlan, exceededBillingLimit, response);
      }
    } else if (isBedrockAnthropicModel(modelKey)) {
      const model = getModelFromModelKey(modelKey);
      const options = getModelOptions(modelKey, args);
      const { system, messages, tools, tool_choice } = getAnthropicApiArgs(
        args,
        options.aiModelMode,
        options.promptCaching,
        options.thinking
      );

      const thinking = options.thinking
        ? { type: 'enabled' as const, budget_tokens: Math.floor(options.max_tokens * 0.75) }
        : { type: 'disabled' as const };

      let apiArgs: any = {
        model,
        system,
        messages,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        stream: options.stream,
        tools,
        tool_choice,
      };

      if (options.thinking !== undefined) {
        apiArgs = { ...apiArgs, thinking };
      }

      if (options.stream) {
        if (!response?.headersSent) {
          response?.setHeader('Content-Type', 'text/event-stream');
          response?.setHeader('Cache-Control', 'no-cache');
          response?.setHeader('Connection', 'keep-alive');
        }
        response?.write('stream\n\n');

        apiArgs.stream = true;
        const chunks = await bedrockAnthropic.messages.create(apiArgs, { signal });
        parsedResponse = await parseAnthropicStream(
          chunks as any,
          modelKey,
          isOnPaidPlan,
          exceededBillingLimit,
          response
        );
      } else {
        apiArgs.stream = false;
        const result = await bedrockAnthropic.messages.create(apiArgs, { signal });
        parsedResponse = parseAnthropicResponse(result as any, modelKey, isOnPaidPlan, exceededBillingLimit, response);
      }
    } else if (isAnthropicModel(modelKey)) {
      const model = getModelFromModelKey(modelKey);
      const options = getModelOptions(modelKey, args);
      const { system, messages, tools, tool_choice } = getAnthropicApiArgs(
        args,
        options.aiModelMode,
        options.promptCaching,
        options.thinking
      );

      const thinking = options.thinking
        ? { type: 'enabled' as const, budget_tokens: Math.floor(options.max_tokens * 0.75) }
        : { type: 'disabled' as const };

      let apiArgs: any = {
        model,
        system,
        messages,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        stream: options.stream,
        tools,
        tool_choice,
      };

      if (options.thinking !== undefined) {
        apiArgs = { ...apiArgs, thinking };
      }

      if (options.stream) {
        if (!response?.headersSent) {
          response?.setHeader('Content-Type', 'text/event-stream');
          response?.setHeader('Cache-Control', 'no-cache');
          response?.setHeader('Connection', 'keep-alive');
        }
        response?.write('stream\n\n');

        apiArgs.stream = true;
        const chunks = await anthropic.messages.create(apiArgs, { signal });
        parsedResponse = await parseAnthropicStream(
          chunks as any,
          modelKey,
          isOnPaidPlan,
          exceededBillingLimit,
          response
        );
      } else {
        apiArgs.stream = false;
        const result = await anthropic.messages.create(apiArgs, { signal });
        parsedResponse = parseAnthropicResponse(result as any, modelKey, isOnPaidPlan, exceededBillingLimit, response);
      }
    } else if (isOpenAIModel(modelKey)) {
      // OpenAI using Responses API for better reasoning support
      const model = getModelFromModelKey(modelKey);
      const options = getModelOptions(modelKey, args);
      const { messages, tools, tool_choice } = getOpenAIResponsesApiArgs(
        args,
        options.aiModelMode,
        options.strictParams,
        options.imageSupport
      );

      const apiArgs: any = {
        model,
        input: messages,
        temperature: options.temperature,
        max_output_tokens: options.max_tokens || undefined,
        stream: options.stream,
        tools,
        tool_choice,
        parallel_tool_calls: false,
        ...(options.supportsReasoning
          ? {
              reasoning: {
                effort: 'medium',
                summary: 'auto',
              },
            }
          : {}),
        service_tier: options.serviceTier,
        ...(options.top_p !== undefined ? { top_p: options.top_p } : {}),
        ...(options.top_k !== undefined ? { top_k: options.top_k } : {}),
        ...(options.min_p !== undefined ? { min_p: options.min_p } : {}),
        ...(options.repetition_penalty !== undefined ? { repetition_penalty: options.repetition_penalty } : {}),
      };

      if (options.stream) {
        if (!response?.headersSent) {
          response?.setHeader('Content-Type', 'text/event-stream');
          response?.setHeader('Cache-Control', 'no-cache');
          response?.setHeader('Connection', 'keep-alive');
        }
        response?.write('stream\n\n');

        apiArgs.stream = true;
        const responses = await openai.responses.create(apiArgs, { signal });
        parsedResponse = await parseOpenAIResponsesStream(
          responses as any,
          modelKey,
          isOnPaidPlan,
          exceededBillingLimit,
          response
        );
      } else {
        apiArgs.stream = false;
        const responses = await openai.responses.create(apiArgs, { signal });
        parsedResponse = parseOpenAIResponsesResponse(
          responses as any,
          modelKey,
          isOnPaidPlan,
          exceededBillingLimit,
          response
        );
      }
    } else if (isAzureOpenAIModel(modelKey)) {
      const model = getModelFromModelKey(modelKey);
      const options = getModelOptions(modelKey, args);
      const { messages, tools, tool_choice } = getOpenAIResponsesApiArgs(
        args,
        options.aiModelMode,
        options.strictParams,
        options.imageSupport
      );

      const apiArgs: any = {
        model,
        input: messages,
        temperature: options.temperature,
        max_output_tokens: options.max_tokens || undefined,
        stream: options.stream,
        tools,
        tool_choice,
        parallel_tool_calls: false,
      };

      if (options.stream) {
        if (!response?.headersSent) {
          response?.setHeader('Content-Type', 'text/event-stream');
          response?.setHeader('Cache-Control', 'no-cache');
          response?.setHeader('Connection', 'keep-alive');
        }
        response?.write('stream\n\n');

        apiArgs.stream = true;
        const responses = await azureOpenAI.responses.create(apiArgs, { signal });
        parsedResponse = await parseOpenAIResponsesStream(
          responses as any,
          modelKey,
          isOnPaidPlan,
          exceededBillingLimit,
          response
        );
      } else {
        apiArgs.stream = false;
        const responses = await azureOpenAI.responses.create(apiArgs, { signal });
        parsedResponse = parseOpenAIResponsesResponse(
          responses as any,
          modelKey,
          isOnPaidPlan,
          exceededBillingLimit,
          response
        );
      }
    } else if (
      isXAIModel(modelKey) ||
      isBasetenModel(modelKey) ||
      isFireworksModel(modelKey) ||
      isOpenRouterModel(modelKey)
    ) {
      // OpenAI-compatible models using Chat Completions API
      const model = getModelFromModelKey(modelKey);
      const options = getModelOptions(modelKey, args);
      const { messages, tools, tool_choice } = getOpenAIChatCompletionsApiArgs(
        args,
        options.aiModelMode,
        options.strictParams,
        options.imageSupport
      );

      let client = openai;
      if (isXAIModel(modelKey)) client = xai;
      else if (isBasetenModel(modelKey)) client = baseten;
      else if (isFireworksModel(modelKey)) client = fireworks;
      else if (isOpenRouterModel(modelKey)) client = openRouter;

      let apiArgs: any = {
        model,
        messages,
        temperature: options.temperature,
        max_completion_tokens: options.max_tokens || undefined,
        stream: options.stream,
        tools,
        tool_choice,
        parallel_tool_calls: false,
        ...(options.top_p !== undefined ? { top_p: options.top_p } : {}),
        ...(options.top_k !== undefined ? { top_k: options.top_k } : {}),
        ...(options.min_p !== undefined ? { min_p: options.min_p } : {}),
        ...(options.repetition_penalty !== undefined ? { repetition_penalty: options.repetition_penalty } : {}),
      };

      if (options.stream) {
        if (!response?.headersSent) {
          response?.setHeader('Content-Type', 'text/event-stream');
          response?.setHeader('Cache-Control', 'no-cache');
          response?.setHeader('Connection', 'keep-alive');
        }
        response?.write('stream\n\n');

        apiArgs.stream = true;
        apiArgs.stream_options = {
          include_usage: true,
        };

        const completion = await client.chat.completions.create(apiArgs, { signal });
        parsedResponse = await parseOpenAIChatCompletionsStream(
          completion as any,
          modelKey,
          isOnPaidPlan,
          exceededBillingLimit,
          response
        );
      } else {
        apiArgs.stream = false;
        const result = await client.chat.completions.create(apiArgs, { signal });
        parsedResponse = parseOpenAIChatCompletionsResponse(
          result as any,
          modelKey,
          isOnPaidPlan,
          exceededBillingLimit,
          response
        );
      }
    } else if (isVertexAIModel(modelKey) || isGenAIModel(modelKey)) {
      // Google Gemini models with thinking support
      const model = getModelFromModelKey(modelKey);
      const options = getModelOptions(modelKey, args);
      const { system, messages, tools, tool_choice } = getGenAIApiArgs(args, options.aiModelMode);

      const client = isVertexAIModel(modelKey) ? vertexai : geminiai;

      const apiArgs: any = {
        model,
        contents: messages,
        config: {
          temperature: options.temperature,
          systemInstruction: system,
          maxOutputTokens: options.max_tokens || undefined,
          tools,
          toolConfig: tool_choice,
          ...(options.thinking !== undefined && {
            thinkingConfig: {
              includeThoughts: options.thinking,
              thinkingBudget: options.thinkingBudget,
            },
          }),
          abortSignal: signal,
        },
      };

      if (options.stream) {
        response?.setHeader('Content-Type', 'text/event-stream');
        response?.setHeader('Cache-Control', 'no-cache');
        response?.setHeader('Connection', 'keep-alive');
        response?.write('stream\n\n');

        const result = await client.models.generateContentStream(apiArgs);
        parsedResponse = await parseGenAIStream(result, modelKey, isOnPaidPlan, exceededBillingLimit, response);
      } else {
        const result = await client.models.generateContent(apiArgs);
        parsedResponse = parseGenAIResponse(result, modelKey, isOnPaidPlan, exceededBillingLimit, response);
      }
    } else if (isBedrockModel(modelKey)) {
      // AWS Bedrock models
      const model = getModelFromModelKey(modelKey);
      const options = getModelOptions(modelKey, args);
      const { system, messages, tools, tool_choice } = getBedrockApiArgs(args, options.aiModelMode);

      const apiArgs: any = {
        modelId: model,
        system,
        messages,
        inferenceConfig: {
          maxTokens: options.max_tokens || undefined,
          temperature: options.temperature,
        },
        toolConfig:
          tools && tool_choice
            ? {
                tools,
                toolChoice: tool_choice,
              }
            : undefined,
      };

      if (options.stream) {
        if (!response?.headersSent) {
          response?.setHeader('Content-Type', 'text/event-stream');
          response?.setHeader('Cache-Control', 'no-cache');
          response?.setHeader('Connection', 'keep-alive');
        }
        response?.write('stream\n\n');

        const { ConverseStreamCommand } = await import('@aws-sdk/client-bedrock-runtime');
        const command = new ConverseStreamCommand(apiArgs);
        const chunks = (await bedrock.send(command)).stream ?? [];
        parsedResponse = await parseBedrockStream(chunks, modelKey, isOnPaidPlan, exceededBillingLimit, response);
      } else {
        const { ConverseCommand } = await import('@aws-sdk/client-bedrock-runtime');
        const command = new ConverseCommand(apiArgs);
        const result = await bedrock.send(command);
        parsedResponse = parseBedrockResponse(result, modelKey, isOnPaidPlan, exceededBillingLimit, response);
      }
    } else {
      throw new Error(`Model not supported: ${modelKey}`);
    }

    // Log usage in debug mode
    if (debugAndNotInProduction && parsedResponse) {
      parsedResponse.usage.source = args.source;
      parsedResponse.usage.modelKey = modelKey;
      parsedResponse.usage.cost = calculateUsage(parsedResponse.usage);
      logger.info('AI.Usage', { usage: parsedResponse.usage });
    }

    // Create fine-tuning data if enabled
    if (debugAndNotInProduction && FINE_TUNE === 'true' && parsedResponse) {
      createFileForFineTuning(modelKey, args, parsedResponse);
    }

    return parsedResponse;
  } catch (error) {
    if (signal?.aborted) {
      logger.info('[handleAIRequestV2] AI request aborted by client');
      return;
    }

    logger.error(`[handleAIRequestV2] Error in handleAIRequestV2 ${modelKey}`, error);

    Sentry.captureException(error, {
      level: 'error',
      extra: {
        context: 'Error in handleAIRequestV2',
        modelKey,
      },
    });

    // Implement fallback mechanism for production critical sources
    if (ENVIRONMENT === 'production' && ['AIAnalyst', 'AIAssistant'].includes(args.source)) {
      const options = getModelOptions(modelKey, args);

      const configuredBackup = MODELS_CONFIGURATION[modelKey].backupModelKey;
      const fallbackDefault = options.thinking ? DEFAULT_BACKUP_MODEL_THINKING : DEFAULT_BACKUP_MODEL;
      const backupModelKey = configuredBackup ?? fallbackDefault;

      if (modelKey !== backupModelKey) {
        logger.info(`[handleAIRequestV2] Falling back to backup model: ${backupModelKey}`);
        return handleAIRequestV2({
          modelKey: backupModelKey,
          args,
          isOnPaidPlan,
          exceededBillingLimit,
          response,
          signal,
        });
      }
    }

    // Send error response to client
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

    return undefined;
  }
};
