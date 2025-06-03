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
  getSystemPromptMessages,
  isContentImage,
  isContentPdfFile,
  isContentTextFile,
  isToolResultMessage,
} from 'quadratic-shared/ai/helpers/message.helper';
import type { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type {
  AIMessagePrompt,
  AIRequestHelperArgs,
  AISource,
  AIUsage,
  AnthropicModelKey,
  BedrockAnthropicModelKey,
  Content,
  ParsedAIResponse,
  ToolResultContent,
  VertexAIAnthropicModelKey,
} from 'quadratic-shared/typesAndSchemasAI';

function convertContent(content: Content): Array<ContentBlockParam> {
  return content.map((content) => {
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
    } else {
      const textBlockParam: TextBlockParam = {
        type: 'text' as const,
        text: content.text,
      };
      return textBlockParam;
    }
  });
}

function convertToolResultContent(content: ToolResultContent): Array<TextBlockParam | ImageBlockParam> {
  return content.map((content) => {
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
      const textBlockParam: TextBlockParam = {
        type: 'text' as const,
        text: content.text,
      };
      return textBlockParam;
    }
  });
}

export function getAnthropicApiArgs(
  args: AIRequestHelperArgs,
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
    text: message,
    ...(cacheRemaining-- > 0 ? { cache_control: { type: 'ephemeral' } } : {}),
  }));

  const messages: MessageParam[] = promptMessages.reduce<MessageParam[]>((acc, message) => {
    if (message.role === 'assistant' && message.contextType === 'userPrompt') {
      const anthropicMessage: MessageParam = {
        role: message.role,
        content: [
          ...message.content
            .filter(
              (content) =>
                content.text &&
                (content.type !== 'anthropic_thinking' || !!content.signature) &&
                (!!thinking || content.type === 'text')
            )
            .map((content) => {
              if (content.type === 'anthropic_thinking') {
                return {
                  type: 'thinking' as const,
                  thinking: content.text,
                  signature: content.signature,
                };
              } else if (content.type === 'anthropic_redacted_thinking') {
                return {
                  type: 'redacted_thinking' as const,
                  data: content.text,
                };
              } else {
                return {
                  type: 'text' as const,
                  text: content.text,
                };
              }
            }),
          ...message.toolCalls.map((toolCall) => ({
            type: 'tool_use' as const,
            id: toolCall.id,
            name: toolCall.name,
            input: JSON.parse(toolCall.arguments),
          })),
        ],
      };
      return [...acc, anthropicMessage];
    } else if (isToolResultMessage(message)) {
      const anthropicMessages: MessageParam = {
        role: message.role,
        content: [
          ...message.content.map((toolResult) => ({
            type: 'tool_result' as const,
            tool_use_id: toolResult.id,
            content: convertToolResultContent(toolResult.content),
          })),
          {
            type: 'text' as const,
            text: 'Given the above tool calls results, continue with your response.',
          },
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

  const tools = getAnthropicTools(source, toolName);
  const tool_choice = tools?.length ? getAnthropicToolChoice(toolName) : undefined;

  return { system, messages, tools, tool_choice };
}

function getAnthropicTools(source: AISource, toolName?: AITool): Tool[] | undefined {
  const tools = Object.entries(aiToolsSpec).filter(([name, toolSpec]) => {
    if (toolName === undefined) {
      return toolSpec.sources.includes(source);
    }
    return name === toolName;
  });

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
  return toolName === undefined ? { type: 'auto' } : { type: 'tool', name: toolName };
}

export async function parseAnthropicStream(
  chunks: Stream<Anthropic.Messages.RawMessageStreamEvent>,
  modelKey: VertexAIAnthropicModelKey | BedrockAnthropicModelKey | AnthropicModelKey,
  response?: Response
): Promise<ParsedAIResponse> {
  const responseMessage: AIMessagePrompt = {
    role: 'assistant',
    content: [],
    contextType: 'userPrompt',
    toolCalls: [],
    modelKey,
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
            responseMessage.content.push({
              type: 'text',
              text: chunk.content_block.text ?? '',
            });

            responseMessage.toolCalls.forEach((toolCall) => {
              toolCall.loading = false;
            });
          } else if (chunk.content_block.type === 'tool_use') {
            responseMessage.toolCalls.push({
              id: chunk.content_block.id,
              name: chunk.content_block.name,
              arguments: '',
              loading: true,
            });
          } else if (chunk.content_block.type === 'thinking') {
            responseMessage.content.push({
              type: 'anthropic_thinking',
              text: chunk.content_block.thinking ?? '',
              signature: chunk.content_block.signature ?? '',
            });

            responseMessage.toolCalls.forEach((toolCall) => {
              toolCall.loading = false;
            });
          } else if (chunk.content_block.type === 'redacted_thinking') {
            responseMessage.content.push({
              type: 'anthropic_redacted_thinking',
              text: chunk.content_block.data ?? '',
            });

            responseMessage.toolCalls.forEach((toolCall) => {
              toolCall.loading = false;
            });
          }
          break;
        case 'content_block_delta':
          if (chunk.delta.type === 'text_delta') {
            let currentContent = responseMessage.content.pop();
            if (currentContent?.type !== 'text') {
              if (currentContent?.text) {
                responseMessage.content.push(currentContent);
              }
              currentContent = {
                type: 'text',
                text: '',
              };
            }
            currentContent.text += chunk.delta.text ?? '';
            responseMessage.content.push(currentContent);
          } else if (chunk.delta.type === 'input_json_delta') {
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
          } else if (chunk.delta.type === 'thinking_delta') {
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
            currentContent.text += chunk.delta.thinking ?? '';
            responseMessage.content.push(currentContent);
          } else if (chunk.delta.type === 'signature_delta') {
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
              currentContent.signature += chunk.delta.signature ?? '';
            }
            responseMessage.content.push(currentContent);
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
    responseMessage.content.push({
      type: 'text',
      text: 'Please try again.',
    });
  }

  if (responseMessage.toolCalls.some((toolCall) => toolCall.loading)) {
    responseMessage.toolCalls.forEach((toolCall) => {
      toolCall.loading = false;
    });
  }

  response?.write(`data: ${JSON.stringify(responseMessage)}\n\n`);
  if (!response?.writableEnded) {
    response?.end();
  }

  return { responseMessage, usage };
}

export function parseAnthropicResponse(
  result: Anthropic.Messages.Message,
  modelKey: VertexAIAnthropicModelKey | BedrockAnthropicModelKey | AnthropicModelKey,
  response?: Response
): ParsedAIResponse {
  const responseMessage: AIMessagePrompt = {
    role: 'assistant',
    content: [],
    contextType: 'userPrompt',
    toolCalls: [],
    modelKey,
  };

  result.content?.forEach((message) => {
    switch (message.type) {
      case 'text':
        responseMessage.content.push({
          type: 'text',
          text: message.text ?? '',
        });
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
        responseMessage.content.push({
          type: 'anthropic_thinking',
          text: message.thinking ?? '',
          signature: message.signature ?? '',
        });
        break;
      case 'redacted_thinking':
        responseMessage.content.push({
          type: 'anthropic_redacted_thinking',
          text: message.data ?? '',
        });
        break;
    }
  });

  if (responseMessage.content.length === 0 && responseMessage.toolCalls.length === 0) {
    responseMessage.content.push({
      type: 'text',
      text: 'Please try again.',
    });
  }

  response?.json(responseMessage);

  const usage: AIUsage = {
    inputTokens: result.usage.input_tokens,
    outputTokens: result.usage.output_tokens,
    cacheReadTokens: result.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: result.usage.cache_creation_input_tokens ?? 0,
  };

  return { responseMessage, usage };
}
