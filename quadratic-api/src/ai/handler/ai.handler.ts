/**
 * AI Handler - Pure LangChain Implementation
 *
 * This module uses LangChain exclusively to abstract all model interactions,
 * providing a unified interface across all providers.
 *
 * Trade-offs accepted for cleaner abstraction:
 * - Thinking blocks are simplified (no incremental visualization)
 * - Tool arguments arrive complete (no character-by-character building)
 * - No tool loading states (tools arrive ready)
 *
 * Benefits gained:
 * - Clean LangChain abstraction
 * - Unified streaming interface
 * - Future-ready for chains and agents
 * - Simpler codebase
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { ChatBedrockConverse } from '@langchain/aws';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import * as Sentry from '@sentry/node';
import type { Response } from 'express';
import {
  createTextContent,
  getSystemPromptMessages,
  isAIPromptMessage,
  isContentImage,
  isContentPdfFile,
  isContentText,
  isContentTextFile,
  isInternalMessage,
  isToolResultMessage,
} from 'quadratic-shared/ai/helpers/message.helper';
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
import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import type { AIModelKey, AIRequestHelperArgs, AIUsage, ParsedAIResponse } from 'quadratic-shared/typesAndSchemasAI';
import {
  ANTHROPIC_API_KEY,
  AWS_S3_ACCESS_KEY_ID,
  AWS_S3_REGION,
  AWS_S3_SECRET_ACCESS_KEY,
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_ENDPOINT,
  BASETEN_API_KEY,
  debugAndNotInProduction,
  ENVIRONMENT,
  FINE_TUNE,
  FIREWORKS_API_KEY,
  GCP_GEMINI_API_KEY,
  GCP_REGION_ANTHROPIC,
  OPEN_ROUTER_API_KEY,
  OPENAI_API_KEY,
  XAI_API_KEY,
} from '../../env-vars';
import logger from '../../utils/logger';
import { createFileForFineTuning } from '../helpers/fineTuning.helper';
import { getAIToolsInOrder } from '../helpers/tools';
import { calculateUsage } from '../helpers/usage.helper';

export interface HandleAIRequestArgs {
  modelKey: AIModelKey;
  args: AIRequestHelperArgs;
  isOnPaidPlan: boolean;
  exceededBillingLimit: boolean;
  response?: Response;
  signal?: AbortSignal;
}

/**
 * Creates LangChain tools from AI tool specifications
 */
function createLangChainTools(
  source: string,
  aiModelMode: string,
  toolName?: AITool
): Array<{ type: 'function'; function: { name: string; description: string; parameters: any } }> | undefined {
  const tools = getAIToolsInOrder().filter(([name, toolSpec]) => {
    if (!toolSpec.aiModelModes.includes(aiModelMode as any)) {
      return false;
    }
    if (toolName === undefined) {
      return toolSpec.sources.includes(source as any);
    }
    return name === toolName;
  });

  if (tools.length === 0) {
    return undefined;
  }

  return tools.map(([name, { description, parameters }]) => ({
    type: 'function' as const,
    function: {
      name,
      description,
      parameters,
    },
  }));
}

/**
 * Converts internal message format to LangChain BaseMessage format
 * Handles text, images, PDFs, tool calls, and tool results
 */
function convertToLangChainMessages(args: AIRequestHelperArgs, modelKey: AIModelKey): BaseMessage[] {
  const messages: BaseMessage[] = [];
  const { systemMessages, promptMessages } = getSystemPromptMessages(args.messages);
  const options = getModelOptions(modelKey, args);

  // Merge all system messages into one (required by Anthropic)
  const mergedSystemMessage = systemMessages
    .map((msg) => msg.trim())
    .filter((msg) => msg.length > 0)
    .join('\n\n');

  if (mergedSystemMessage) {
    messages.push(new SystemMessage(mergedSystemMessage));
  }

  // Convert prompt messages
  for (const msg of promptMessages) {
    if (isInternalMessage(msg)) {
      continue;
    }

    if (isAIPromptMessage(msg)) {
      // Assistant message with potential tool calls
      const textContent = msg.content
        .filter((c) => isContentText(c) && 'text' in c && c.text.trim())
        .map((c) => (isContentText(c) && 'text' in c ? c.text.trim() : ''))
        .join('\n');

      // Extract thinking blocks
      const thinkingBlocks = msg.content.filter(
        (c) => c.type === 'anthropic_thinking' || c.type === 'anthropic_redacted_thinking'
      );

      // For Anthropic, we need to format content as blocks when there are tool calls
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        // Use Anthropic's native content block format (LangChain's tool_calls conversion is buggy)
        const contentBlocks: any[] = [];

        // Add text content first
        if (textContent) {
          contentBlocks.push({
            type: 'text',
            text: textContent,
          });
        }

        // Add tool use blocks
        for (const tc of msg.toolCalls) {
          contentBlocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: JSON.parse(tc.arguments),
          });
        }

        messages.push(new AIMessage({ content: contentBlocks }));
      } else {
        // No tool calls - simple text message
        messages.push(new AIMessage({ content: textContent || ' ' }));
      }
    } else if (isToolResultMessage(msg)) {
      // Tool result messages
      for (const toolResult of msg.content) {
        const resultContent = toolResult.content
          .filter((c) => isContentText(c) && 'text' in c && c.text.trim())
          .map((c) => (isContentText(c) && 'text' in c ? c.text.trim() : ''))
          .join('\n');

        messages.push(
          new ToolMessage({
            content: resultContent || 'No content',
            tool_call_id: toolResult.id,
          })
        );
      }
    } else if (msg.role === 'user') {
      // User message with potential multimodal content
      const contentParts: any[] = [];

      for (const content of msg.content) {
        if (isContentText(content) && content.text.trim()) {
          contentParts.push({
            type: 'text',
            text: content.text.trim(),
          });
        } else if (isContentImage(content)) {
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: `data:${content.mimeType};base64,${content.data}`,
            },
          });
        } else if (isContentPdfFile(content) || isContentTextFile(content)) {
          contentParts.push({
            type: 'text',
            text: `[File: ${content.fileName}]\n${content.data}`,
          });
        }
      }

      if (contentParts.length > 0) {
        messages.push(
          new HumanMessage({
            content: contentParts.length === 1 && contentParts[0].type === 'text' ? contentParts[0].text : contentParts,
          })
        );
      }
    }
  }

  return messages;
}

/**
 * Creates appropriate LangChain model instance based on provider
 */
function createChatModel(modelKey: AIModelKey, args: AIRequestHelperArgs): any {
  const options = getModelOptions(modelKey, args);
  const modelName = getModelFromModelKey(modelKey);
  const tools = createLangChainTools(args.source, options.aiModelMode, args.toolName);

  // Anthropic models
  if (isAnthropicModel(modelKey)) {
    const modelConfig: any = {
      model: modelName,
      temperature: options.temperature,
      maxTokens: options.max_tokens,
      streaming: options.stream,
      anthropicApiKey: ANTHROPIC_API_KEY,
    };

    // Add thinking configuration if enabled
    // Disable thinking if there are tool results in the conversation (LangChain limitation)
    const hasToolResults = args.messages.some((m) => m.contextType === 'toolResult');
    if (options.thinking && !hasToolResults) {
      modelConfig.thinking = {
        type: 'enabled',
        budget_tokens: Math.floor(options.max_tokens * 0.75),
      };
    }

    const model = new ChatAnthropic(modelConfig);
    return tools ? model.bindTools(tools) : model;
  }

  // Vertex AI Anthropic
  if (isVertexAIAnthropicModel(modelKey)) {
    const model = new ChatAnthropic({
      model: modelName,
      temperature: options.temperature,
      maxTokens: options.max_tokens,
      streaming: options.stream,
      clientOptions: {
        defaultHeaders: {
          'anthropic-version': '2023-06-01',
        },
      },
      anthropicApiUrl: `https://${GCP_REGION_ANTHROPIC}-aiplatform.googleapis.com`,
      anthropicApiKey: ANTHROPIC_API_KEY,
    });
    return tools ? model.bindTools(tools) : model;
  }

  // Bedrock Anthropic
  if (isBedrockAnthropicModel(modelKey)) {
    const model = new ChatBedrockConverse({
      model: modelName,
      region: AWS_S3_REGION,
      credentials: {
        accessKeyId: AWS_S3_ACCESS_KEY_ID,
        secretAccessKey: AWS_S3_SECRET_ACCESS_KEY,
      },
      temperature: options.temperature,
      maxTokens: options.max_tokens,
      streaming: options.stream,
    });
    return tools ? model.bindTools(tools) : model;
  }

  // OpenAI
  if (isOpenAIModel(modelKey)) {
    if (!OPENAI_API_KEY) {
      const error = `OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.`;
      logger.error('[AI Handler] OpenAI API key missing', { error });
      throw new Error(error);
    }
    const model = new ChatOpenAI({
      model: modelName,
      temperature: options.temperature,
      maxTokens: options.max_tokens,
      streaming: options.stream,
      openAIApiKey: OPENAI_API_KEY,
    });
    return tools ? model.bindTools(tools) : model;
  }

  // Azure OpenAI
  if (isAzureOpenAIModel(modelKey)) {
    if (!AZURE_OPENAI_API_KEY || !AZURE_OPENAI_ENDPOINT) {
      const error = `Azure OpenAI credentials not configured. Please set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT environment variables.`;
      logger.error('[AI Handler] Azure OpenAI credentials missing', { error });
      throw new Error(error);
    }
    const model = new ChatOpenAI({
      model: modelName,
      temperature: options.temperature,
      maxTokens: options.max_tokens,
      streaming: options.stream,
      openAIApiKey: AZURE_OPENAI_API_KEY,
      configuration: {
        baseURL: AZURE_OPENAI_ENDPOINT,
      },
    });
    return tools ? model.bindTools(tools) : model;
  }

  // X.AI, Baseten, Fireworks, OpenRouter
  if (isXAIModel(modelKey) || isBasetenModel(modelKey) || isFireworksModel(modelKey) || isOpenRouterModel(modelKey)) {
    let apiKey = OPENAI_API_KEY;
    let baseURL = '';
    const defaultHeaders: any = {};

    if (isXAIModel(modelKey)) {
      apiKey = XAI_API_KEY;
      baseURL = 'https://api.x.ai/v1';
    } else if (isBasetenModel(modelKey)) {
      apiKey = BASETEN_API_KEY;
      baseURL = 'https://inference.baseten.co/v1';
    } else if (isFireworksModel(modelKey)) {
      apiKey = FIREWORKS_API_KEY;
      baseURL = 'https://api.fireworks.ai/inference/v1';
    } else if (isOpenRouterModel(modelKey)) {
      apiKey = OPEN_ROUTER_API_KEY;
      baseURL = 'https://openrouter.ai/api/v1';
      defaultHeaders['HTTP-Referer'] = 'https://quadratic.ai';
      defaultHeaders['X-Title'] = 'Quadratic';
    }

    const model = new ChatOpenAI({
      model: modelName,
      temperature: options.temperature,
      maxTokens: options.max_tokens,
      streaming: options.stream,
      openAIApiKey: apiKey,
      configuration: {
        baseURL,
        defaultHeaders,
      },
    });
    return tools ? model.bindTools(tools) : model;
  }

  // Google Gemini
  if (isGenAIModel(modelKey) || isVertexAIModel(modelKey)) {
    const model = new ChatGoogleGenerativeAI({
      model: modelName,
      temperature: options.temperature,
      maxOutputTokens: options.max_tokens,
      streaming: options.stream,
      apiKey: GCP_GEMINI_API_KEY,
    });
    return tools ? model.bindTools(tools) : model;
  }

  // AWS Bedrock
  if (isBedrockModel(modelKey)) {
    const model = new ChatBedrockConverse({
      model: modelName,
      region: AWS_S3_REGION,
      credentials: {
        accessKeyId: AWS_S3_ACCESS_KEY_ID,
        secretAccessKey: AWS_S3_SECRET_ACCESS_KEY,
      },
      temperature: options.temperature,
      maxTokens: options.max_tokens,
      streaming: options.stream,
    });
    return tools ? model.bindTools(tools) : model;
  }

  throw new Error(`Model not supported: ${modelKey}`);
}

/**
 * Extracts usage data from LangChain response metadata
 */
function extractUsage(responseMetadata: any, usageMetadata: any): AIUsage {
  const usage: AIUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };

  if (responseMetadata?.usage) {
    const meta = responseMetadata.usage;
    // Anthropic format
    usage.inputTokens = meta.input_tokens || usage.inputTokens;
    usage.outputTokens = meta.output_tokens || usage.outputTokens;
    usage.cacheReadTokens = meta.cache_read_input_tokens || meta.cache_read_tokens || usage.cacheReadTokens;
    usage.cacheWriteTokens = meta.cache_creation_input_tokens || meta.cache_write_tokens || usage.cacheWriteTokens;

    // OpenAI format
    usage.inputTokens = meta.prompt_tokens || usage.inputTokens;
    usage.outputTokens = meta.completion_tokens || usage.outputTokens;
    usage.cacheReadTokens = meta.prompt_tokens_details?.cached_tokens || usage.cacheReadTokens;

    // Google format
    usage.inputTokens = meta.promptTokenCount || usage.inputTokens;
    usage.outputTokens = meta.candidatesTokenCount || usage.outputTokens;
  }

  // LangChain unified format
  if (usageMetadata) {
    usage.inputTokens = usageMetadata.input_tokens || usage.inputTokens;
    usage.outputTokens = usageMetadata.output_tokens || usage.outputTokens;
  }

  return usage;
}

/**
 * Handles streaming responses using LangChain's unified streaming
 */
async function handleStreamingResponse(
  chatModel: any,
  messages: BaseMessage[],
  args: AIRequestHelperArgs,
  modelKey: AIModelKey,
  isOnPaidPlan: boolean,
  exceededBillingLimit: boolean,
  response?: Response,
  signal?: AbortSignal
): Promise<ParsedAIResponse> {
  if (!response?.headersSent) {
    response?.setHeader('Content-Type', 'text/event-stream');
    response?.setHeader('Cache-Control', 'no-cache');
    response?.setHeader('Connection', 'keep-alive');
  }
  response?.write('stream\n\n');

  let fullContent = '';
  const contentBlocks: any[] = [];
  const toolCalls: any[] = [];
  let usage: AIUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };

  try {
    const stream = await chatModel.stream(messages, { signal });

    let chunkCount = 0;
    for await (const chunk of stream) {
      chunkCount++;

      if (signal?.aborted) {
        break;
      }

      // Extract content - handle both string and array formats
      let content = '';
      if (typeof chunk.content === 'string') {
        content = chunk.content;
        if (content) {
          fullContent += content;
        }
      } else if (Array.isArray(chunk.content)) {
        // Content is an array of content blocks (e.g., text, thinking blocks)
        for (const block of chunk.content) {
          if (block.type === 'text' && block.text) {
            content += block.text;
            fullContent += block.text;
          } else if (block.type === 'thinking' && block.thinking) {
            // Handle Anthropic thinking blocks
            const existingThinking = contentBlocks.find((b) => b.type === 'anthropic_thinking' && !b.signature);
            if (existingThinking) {
              existingThinking.text += block.thinking;
            } else {
              contentBlocks.push({
                type: 'anthropic_thinking',
                text: block.thinking,
                signature: block.signature || '',
              });
            }
          } else if (block.type === 'redacted_thinking' && block.data) {
            // Handle redacted thinking blocks
            const existingRedacted = contentBlocks.find((b) => b.type === 'anthropic_redacted_thinking');
            if (existingRedacted) {
              existingRedacted.text += block.data;
            } else {
              contentBlocks.push({
                type: 'anthropic_redacted_thinking',
                text: block.data,
              });
            }
          }
        }
      }

      // Always send the complete state on every chunk (matching old implementation)
      // Filter valid tool calls at this point
      const currentValidToolCalls = toolCalls.filter((tc) => tc.id && tc.name && tc.arguments);

      // Only send if we have content or tool calls to avoid sending empty updates
      if (fullContent || contentBlocks.length > 0 || currentValidToolCalls.length > 0) {
        // Build content array with text and thinking blocks
        const responseContent: any[] = [];
        if (fullContent) {
          responseContent.push(createTextContent(fullContent));
        }
        // Add thinking blocks
        responseContent.push(...contentBlocks);

        const responseMessage: Partial<ApiTypes['/v0/ai/chat.POST.response']> = {
          role: 'assistant',
          content: responseContent,
          contextType: 'userPrompt',
          toolCalls: currentValidToolCalls,
          modelKey,
          isOnPaidPlan,
          exceededBillingLimit,
        };
        response?.write(`data: ${JSON.stringify(responseMessage)}\n\n`);
      }

      // Extract tool calls from tool_call_chunks (LangChain streaming format)
      if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
        for (const tcc of chunk.tool_call_chunks) {
          // Use index to match tool calls, not ID (chunks may not have stable IDs)
          const index = tcc.index !== undefined ? tcc.index : 0;

          // Ensure we have a tool call at this index
          while (toolCalls.length <= index) {
            toolCalls.push({
              id: '',
              name: '',
              arguments: '',
              loading: false,
            });
          }

          const toolCall = toolCalls[index];

          // Accumulate the tool call data
          if (tcc.id) toolCall.id = tcc.id;
          if (tcc.name) toolCall.name = tcc.name;
          if (tcc.args) toolCall.arguments += tcc.args;
        }
      }

      // Also handle complete tool_calls (non-streaming or final)
      if (chunk.tool_calls && chunk.tool_calls.length > 0) {
        for (const tc of chunk.tool_calls) {
          const existing = toolCalls.find((t) => t.id === tc.id);
          if (!existing) {
            // New tool call - only add if it has meaningful content
            const argsString = typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args || {});
            // Skip if args are empty object "{}"
            if (argsString !== '{}' || tc.name) {
              const toolCall = {
                id: tc.id || `call_${Date.now()}`,
                name: tc.name || '',
                arguments: argsString,
                loading: false,
              };
              toolCalls.push(toolCall);
            }
          } else {
            // Update existing tool call - only replace if we have non-empty args
            if (tc.args && Object.keys(tc.args).length > 0) {
              existing.arguments = typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args);
            }
          }
        }
      }

      // Extract usage
      const chunkUsage = extractUsage(chunk.response_metadata, chunk.usage_metadata);
      usage.inputTokens = Math.max(usage.inputTokens, chunkUsage.inputTokens);
      usage.outputTokens = Math.max(usage.outputTokens, chunkUsage.outputTokens);
      usage.cacheReadTokens = Math.max(usage.cacheReadTokens, chunkUsage.cacheReadTokens);
      usage.cacheWriteTokens = Math.max(usage.cacheWriteTokens, chunkUsage.cacheWriteTokens);
    }

    // Filter out empty/invalid tool calls
    const validToolCalls = toolCalls.filter((tc) => tc.id && tc.name && tc.arguments);

    // Build final content array with text and thinking blocks
    const finalContent: any[] = [];
    if (fullContent) {
      finalContent.push(createTextContent(fullContent));
    }
    // Filter thinking blocks to only include those with signatures (completed thinking)
    const completedThinkingBlocks = contentBlocks.filter((b) => b.type !== 'anthropic_thinking' || b.signature);
    finalContent.push(...completedThinkingBlocks);

    // Send final message one more time to ensure complete state (matching old implementation)
    const finalResponseMessage: ApiTypes['/v0/ai/chat.POST.response'] = {
      role: 'assistant',
      content: finalContent,
      contextType: 'userPrompt',
      toolCalls: validToolCalls,
      modelKey,
      isOnPaidPlan,
      exceededBillingLimit,
    };

    response?.write(`data: ${JSON.stringify(finalResponseMessage)}\n\n`);
    response?.end();

    return {
      responseMessage: {
        role: 'assistant',
        content: finalContent.length > 0 ? finalContent : [createTextContent(' ')],
        contextType: 'userPrompt',
        toolCalls: validToolCalls,
        modelKey,
      },
      usage: {
        ...usage,
        source: args.source,
        modelKey,
      },
    };
  } catch (error) {
    if (signal?.aborted) {
      logger.info('[handleStreamingResponse] Stream aborted by client');
    }
    throw error;
  }
}

/**
 * Handles non-streaming responses
 */
async function handleNonStreamingResponse(
  chatModel: any,
  messages: BaseMessage[],
  args: AIRequestHelperArgs,
  modelKey: AIModelKey,
  isOnPaidPlan: boolean,
  exceededBillingLimit: boolean,
  response?: Response,
  signal?: AbortSignal
): Promise<ParsedAIResponse> {
  const result = await chatModel.invoke(messages, { signal });

  const content = typeof result.content === 'string' ? result.content : '';
  const toolCalls: any[] = [];

  // Extract tool calls
  if (result.tool_calls && result.tool_calls.length > 0) {
    for (const tc of result.tool_calls) {
      toolCalls.push({
        id: tc.id || `call_${Date.now()}`,
        name: tc.name || '',
        arguments: typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args || {}),
        loading: false,
      });
    }
  }

  const usage = extractUsage(result.response_metadata, result.usage_metadata);

  const parsedResponse: ParsedAIResponse = {
    responseMessage: {
      role: 'assistant',
      content: [createTextContent(content || ' ')],
      contextType: 'userPrompt',
      toolCalls,
      modelKey,
    },
    usage: {
      ...usage,
      source: args.source,
      modelKey,
    },
  };

  const apiResponse = {
    ...parsedResponse.responseMessage,
    isOnPaidPlan,
    exceededBillingLimit,
  };
  response?.json(apiResponse);

  return parsedResponse;
}

/**
 * Main AI request handler using pure LangChain abstractions
 */
export const handleAIRequest = async ({
  modelKey,
  args,
  isOnPaidPlan,
  exceededBillingLimit,
  response,
  signal,
}: HandleAIRequestArgs): Promise<ParsedAIResponse | undefined> => {
  try {
    const chatModel = createChatModel(modelKey, args);
    const messages = convertToLangChainMessages(args, modelKey);
    const options = getModelOptions(modelKey, args);

    let parsedResponse: ParsedAIResponse;

    if (options.stream) {
      parsedResponse = await handleStreamingResponse(
        chatModel,
        messages,
        args,
        modelKey,
        isOnPaidPlan,
        exceededBillingLimit,
        response,
        signal
      );
    } else {
      parsedResponse = await handleNonStreamingResponse(
        chatModel,
        messages,
        args,
        modelKey,
        isOnPaidPlan,
        exceededBillingLimit,
        response,
        signal
      );
    }

    // Log usage in debug mode
    if (debugAndNotInProduction && parsedResponse) {
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
      logger.info('[handleAIRequest] AI request aborted by client');
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

    // Fallback mechanism for production
    if (ENVIRONMENT === 'production' && ['AIAnalyst', 'AIAssistant'].includes(args.source)) {
      const options = getModelOptions(modelKey, args);

      const configuredBackup = MODELS_CONFIGURATION[modelKey].backupModelKey;
      const fallbackDefault = options.thinking ? DEFAULT_BACKUP_MODEL_THINKING : DEFAULT_BACKUP_MODEL;
      const backupModelKey = configuredBackup ?? fallbackDefault;

      if (modelKey !== backupModelKey) {
        logger.info(`[handleAIRequest] Falling back to backup model: ${backupModelKey}`);
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

    // Send error response
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

    // Try to get model options, but handle case where model is invalid
    let shouldStream = false;
    try {
      const options = getModelOptions(modelKey, args);
      shouldStream = options.stream;
    } catch (e) {
      // Model key is invalid, default to non-streaming
      shouldStream = false;
    }

    if (!shouldStream || !response?.headersSent) {
      response?.json(responseMessage);
    } else {
      response?.write(`data: ${JSON.stringify(responseMessage)}\n\n`);
      response?.end();
    }

    return undefined;
  }
};
