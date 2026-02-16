import type Anthropic from '@anthropic-ai/sdk';
import type {
  ContentBlockParam,
  DocumentBlockParam,
  ImageBlockParam,
  MessageParam,
  TextBlockParam,
  Tool,
  ToolChoice,
} from '@anthropic-ai/sdk/resources';
import type { Stream } from '@anthropic-ai/sdk/streaming';
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
import type { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import type {
  AIRequestHelperArgs,
  AIUsage,
  AnthropicModelKey,
  BedrockAnthropicModelKey,
  Content,
  ModelMode,
  ParsedAIResponse,
  ToolResultContent,
  VertexAIAnthropicModelKey,
} from 'quadratic-shared/typesAndSchemasAI';
import { getOrphanFilterIds } from './filterOrphanedToolCalls';
import { getFilteredTools } from './tools';

function convertContent(content: Content): Array<ContentBlockParam> {
  return content
    .filter((content) => {
      // Filter out empty text
      if ('text' in content && !content.text.trim()) return false;
      // Filter out empty data (images, PDFs, files)
      if ('data' in content && !content.data) return false;
      return true;
    })
    .map((content) => {
      if (isContentImage(content)) {
        const imageBlockParam: ImageBlockParam = {
          type: 'image' as const,
          source: {
            data: content.data,
            media_type: content.mimeType,
            type: 'base64' as const,
          },
        };
        return imageBlockParam;
      } else if (isContentPdfFile(content)) {
        const documentBlockParam: DocumentBlockParam = {
          type: 'document' as const,
          source: {
            data: content.data,
            media_type: content.mimeType,
            type: 'base64' as const,
          },
          title: content.fileName,
        };
        return documentBlockParam;
      } else if (isContentTextFile(content)) {
        const documentBlockParam: DocumentBlockParam = {
          type: 'document' as const,
          source: {
            data: content.data,
            media_type: content.mimeType,
            type: 'text' as const,
          },
          title: content.fileName,
        };
        return documentBlockParam;
      } else if (isContentText(content)) {
        const textBlockParam: TextBlockParam = createTextContent(content.text.trim());
        return textBlockParam;
      } else {
        return undefined;
      }
    })
    .filter((content) => content !== undefined);
}

function convertToolResultContent(content: ToolResultContent): Array<TextBlockParam | ImageBlockParam> {
  return content
    .filter((content) => {
      // Filter out empty text
      if ('text' in content && !content.text.trim()) return false;
      // Filter out empty data (images)
      if ('data' in content && !content.data) return false;
      return true;
    })
    .map((content) => {
      if (isContentImage(content)) {
        const imageBlockParam: ImageBlockParam = {
          type: 'image' as const,
          source: {
            data: content.data,
            media_type: content.mimeType,
            type: 'base64' as const,
          },
        };
        return imageBlockParam;
      } else {
        const textBlockParam: TextBlockParam = createTextContent(content.text.trim());
        return textBlockParam;
      }
    });
}

export function getAnthropicApiArgs(
  args: AIRequestHelperArgs,
  aiModelMode: ModelMode,
  promptCaching: boolean,
  thinking: boolean | undefined
): {
  system: TextBlockParam[] | undefined;
  messages: MessageParam[];
  tools: Tool[] | undefined;
  tool_choice: ToolChoice | undefined;
} {
  const { messages: chatMessages, toolName, source } = args;

  const { systemMessages, promptMessages } = getSystemPromptMessages(chatMessages);

  let cacheRemaining = promptCaching ? 4 : 0;
  const system: TextBlockParam[] = systemMessages.map((message) => ({
    type: 'text' as const,
    text: message.trim(),
    ...(cacheRemaining-- > 0 ? { cache_control: { type: 'ephemeral' } } : {}),
  }));

  const { validToolCallIds: validToolUseIds, existingToolResultIds } = getOrphanFilterIds(promptMessages);

  const messages: MessageParam[] = promptMessages.reduce<MessageParam[]>((acc, message) => {
    if (isInternalMessage(message)) {
      return acc;
    } else if (isAIPromptMessage(message)) {
      const filteredContent = message.content
        .filter(
          (content) =>
            !!content.text.trim() &&
            (content.type !== 'anthropic_thinking' || !!content.signature) &&
            (!!thinking || isContentText(content))
        )
        .map((content) => {
          switch (content.type) {
            case 'anthropic_thinking':
              return {
                type: 'thinking' as const,
                thinking: content.text,
                signature: content.signature,
              };
            case 'anthropic_redacted_thinking':
              return {
                type: 'redacted_thinking' as const,
                data: content.text,
              };
            default:
              return createTextContent(content.text.trim());
          }
        });

      // Filter out tool_use blocks that don't have corresponding tool_results
      // This can happen when chat is forked mid-tool-call or abort leaves inconsistent state
      const toolUseContent = message.toolCalls
        .filter((toolCall) => existingToolResultIds.has(toolCall.id))
        .map((toolCall) => ({
          type: 'tool_use' as const,
          id: toolCall.id,
          name: toolCall.name,
          input: toolCall.arguments ? JSON.parse(toolCall.arguments) : {},
        }));

      const combinedContent = [...filteredContent, ...toolUseContent];

      // Skip messages with empty content to avoid API errors
      if (combinedContent.length === 0) {
        return acc;
      }

      const anthropicMessage: MessageParam = {
        role: message.role,
        content: combinedContent,
      };
      return [...acc, anthropicMessage];
    } else if (isToolResultMessage(message)) {
      // Filter out tool results that reference non-existent tool_use IDs
      // This can happen when user aborts mid-tool-call and tool calls are cleared
      const validToolResults = message.content.filter((toolResult) => validToolUseIds.has(toolResult.id));

      // Skip entirely if no valid tool results remain
      if (validToolResults.length === 0) {
        return acc;
      }

      const anthropicMessages: MessageParam = {
        role: message.role,
        content: [
          ...validToolResults.map((toolResult) => ({
            type: 'tool_result' as const,
            tool_use_id: toolResult.id,
            content: convertToolResultContent(toolResult.content),
          })),
          createTextContent('Given the above tool calls results, continue with your response.'),
        ],
      };
      return [...acc, anthropicMessages];
    } else if (message.content.length) {
      const anthropicMessage: MessageParam = {
        role: message.role,
        content: convertContent(message.content),
      };
      return [...acc, anthropicMessage];
    } else {
      return acc;
    }
  }, []);

  const tools = getAnthropicTools(source, aiModelMode, toolName);
  const tool_choice = tools?.length ? getAnthropicToolChoice(toolName) : undefined;

  return { system, messages, tools, tool_choice };
}

function getAnthropicTools(
  source: AIRequestHelperArgs['source'],
  aiModelMode: ModelMode,
  toolName?: AITool
): Tool[] | undefined {
  const tools = getFilteredTools({ source, aiModelMode, toolName });

  if (tools.length === 0) {
    return undefined;
  }

  const anthropicTools: Tool[] = tools.map(
    ([name, { description, parameters: input_schema }]): Tool => ({
      name,
      description,
      input_schema,
    })
  );

  return anthropicTools;
}

function getAnthropicToolChoice(toolName?: AITool): ToolChoice {
  return toolName === undefined ? { type: 'auto', disable_parallel_tool_use: true } : { type: 'tool', name: toolName };
}

export async function parseAnthropicStream(
  chunks: Stream<Anthropic.Messages.RawMessageStreamEvent>,
  modelKey: VertexAIAnthropicModelKey | BedrockAnthropicModelKey | AnthropicModelKey,
  isOnPaidPlan: boolean,
  exceededBillingLimit: boolean,
  response?: Response
): Promise<ParsedAIResponse> {
  const responseMessage: ApiTypes['/v0/ai/chat.POST.response'] = {
    role: 'assistant',
    content: [],
    contextType: 'userPrompt',
    toolCalls: [],
    modelKey,
    isOnPaidPlan,
    exceededBillingLimit,
  };

  response?.write(`data: ${JSON.stringify(responseMessage)}\n\n`);

  const usage: AIUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };

  for await (const chunk of chunks) {
    if (!response?.writableEnded) {
      switch (chunk.type) {
        case 'content_block_start':
          if (chunk.content_block.type === 'text') {
            if (chunk.content_block.text.trim()) {
              responseMessage.content.push(createTextContent(chunk.content_block.text));
              responseMessage.toolCalls.forEach((toolCall) => {
                toolCall.loading = false;
              });
            }
          } else if (chunk.content_block.type === 'tool_use') {
            responseMessage.toolCalls.push({
              id: chunk.content_block.id,
              name: chunk.content_block.name,
              arguments: '',
              loading: true,
            });
          } else if (chunk.content_block.type === 'thinking') {
            if (chunk.content_block.thinking) {
              responseMessage.content.push({
                type: 'anthropic_thinking',
                text: chunk.content_block.thinking,
                signature: chunk.content_block.signature,
              });

              responseMessage.toolCalls.forEach((toolCall) => {
                toolCall.loading = false;
              });
            }
          } else if (chunk.content_block.type === 'redacted_thinking') {
            if (chunk.content_block.data) {
              responseMessage.content.push({
                type: 'anthropic_redacted_thinking',
                text: chunk.content_block.data,
              });

              responseMessage.toolCalls.forEach((toolCall) => {
                toolCall.loading = false;
              });
            }
          }
          break;

        case 'content_block_delta':
          if (chunk.delta.type === 'text_delta') {
            if (chunk.delta.text) {
              let currentContent = responseMessage.content.pop();
              if (currentContent?.type !== 'text') {
                if (currentContent?.text) {
                  responseMessage.content.push(currentContent);
                }
                currentContent = createTextContent('');
              }

              currentContent.text += chunk.delta.text ?? '';
              responseMessage.content.push(currentContent);
            }
          } else if (chunk.delta.type === 'input_json_delta') {
            if (chunk.delta.partial_json) {
              const toolCall = {
                ...(responseMessage.toolCalls.pop() ?? {
                  id: '',
                  name: '',
                  arguments: '',
                  loading: true,
                }),
              };

              toolCall.arguments += chunk.delta.partial_json;
              responseMessage.toolCalls.push(toolCall);
            }
          } else if (chunk.delta.type === 'thinking_delta') {
            if (chunk.delta.thinking) {
              let currentContent = responseMessage.content.pop();
              if (currentContent?.type !== 'anthropic_thinking') {
                if (currentContent?.text) {
                  responseMessage.content.push(currentContent);
                }
                currentContent = {
                  type: 'anthropic_thinking',
                  text: '',
                  signature: '',
                };
              }

              currentContent.text += chunk.delta.thinking;
              responseMessage.content.push(currentContent);
            }
          } else if (chunk.delta.type === 'signature_delta') {
            if (chunk.delta.signature) {
              let currentContent = responseMessage.content.pop();
              if (currentContent?.type !== 'anthropic_thinking') {
                if (currentContent?.text) {
                  responseMessage.content.push(currentContent);
                }
                currentContent = {
                  type: 'anthropic_thinking',
                  text: '',
                  signature: '',
                };
              }

              if (currentContent.type === 'anthropic_thinking') {
                currentContent.signature += chunk.delta.signature;
              }
              responseMessage.content.push(currentContent);
            }
          }
          break;

        case 'content_block_stop':
          {
            const toolCall = responseMessage.toolCalls.pop();
            if (toolCall) {
              responseMessage.toolCalls.push({ ...toolCall, loading: false });
            }
          }
          break;

        case 'message_start':
          if (chunk.message.usage) {
            usage.inputTokens = Math.max(usage.inputTokens, chunk.message.usage.input_tokens);
            usage.outputTokens = Math.max(usage.outputTokens, chunk.message.usage.output_tokens);
            usage.cacheReadTokens = Math.max(usage.cacheReadTokens, chunk.message.usage.cache_read_input_tokens ?? 0);
            usage.cacheWriteTokens = Math.max(
              usage.cacheWriteTokens,
              chunk.message.usage.cache_creation_input_tokens ?? 0
            );
          }
          break;

        case 'message_delta':
          if (chunk.usage) {
            usage.outputTokens = Math.max(usage.outputTokens, chunk.usage.output_tokens);
          }
          break;
      }

      response?.write(`data: ${JSON.stringify(responseMessage)}\n\n`);
    } else {
      break;
    }
  }

  responseMessage.content = responseMessage.content.filter(
    (content) => !!content.text && (content.type !== 'anthropic_thinking' || !!content.signature)
  );

  if (responseMessage.content.length === 0 && responseMessage.toolCalls.length === 0) {
    throw new Error('Empty response');
  }

  if (responseMessage.toolCalls.some((toolCall) => toolCall.loading)) {
    responseMessage.toolCalls.forEach((toolCall) => {
      toolCall.loading = false;
    });
  }

  // Include usage in the final response
  responseMessage.usage = usage;

  response?.write(`data: ${JSON.stringify(responseMessage)}\n\n`);
  if (!response?.writableEnded) {
    response?.end();
  }

  return { responseMessage, usage };
}

export function parseAnthropicResponse(
  result: Anthropic.Messages.Message,
  modelKey: VertexAIAnthropicModelKey | BedrockAnthropicModelKey | AnthropicModelKey,
  isOnPaidPlan: boolean,
  exceededBillingLimit: boolean,
  response?: Response
): ParsedAIResponse {
  const responseMessage: ApiTypes['/v0/ai/chat.POST.response'] = {
    role: 'assistant',
    content: [],
    contextType: 'userPrompt',
    toolCalls: [],
    modelKey,
    isOnPaidPlan,
    exceededBillingLimit,
  };

  result.content?.forEach((message) => {
    switch (message.type) {
      case 'text':
        if (message.text) {
          responseMessage.content.push(createTextContent(message.text));
        }
        break;

      case 'tool_use':
        responseMessage.toolCalls.push({
          id: message.id,
          name: message.name,
          arguments: JSON.stringify(message.input),
          loading: false,
        });
        break;

      case 'thinking':
        if (message.thinking) {
          responseMessage.content.push({
            type: 'anthropic_thinking',
            text: message.thinking,
            signature: message.signature,
          });
        }
        break;

      case 'redacted_thinking':
        if (message.data) {
          responseMessage.content.push({
            type: 'anthropic_redacted_thinking',
            text: message.data,
          });
        }
        break;
    }
  });

  if (responseMessage.content.length === 0 && responseMessage.toolCalls.length === 0) {
    throw new Error('Empty response');
  }

  const usage: AIUsage = {
    inputTokens: result.usage.input_tokens,
    outputTokens: result.usage.output_tokens,
    cacheReadTokens: result.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: result.usage.cache_creation_input_tokens ?? 0,
  };

  // Include usage in the response
  responseMessage.usage = usage;

  response?.json(responseMessage);

  return { responseMessage, usage };
}
