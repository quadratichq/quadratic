import type {
  ContentBlock,
  ConverseResponse,
  ConverseStreamOutput,
  DocumentBlock,
  DocumentFormat,
  ImageBlock,
  ImageFormat,
  Message,
  SystemContentBlock,
  Tool,
  ToolChoice,
  ToolResultContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import type { Response } from 'express';
import { EmptyMessagesError } from './errors';
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
  AISource,
  AIUsage,
  BedrockModelKey,
  Content,
  ModelMode,
  ParsedAIResponse,
  ToolResultContent,
} from 'quadratic-shared/typesAndSchemasAI';
import { v4 } from 'uuid';
import { getAIToolsInOrder } from './tools';

function convertContent(content: Content): ContentBlock[] {
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
        const image: ImageBlock = {
          format: content.mimeType.split('/')[1] as ImageFormat,
          source: { bytes: Uint8Array.from(Buffer.from(content.data, 'base64')) },
        };
        return { image };
      } else if (isContentPdfFile(content) || isContentTextFile(content)) {
        const document: DocumentBlock = {
          format: content.mimeType.split('/')[1] as DocumentFormat,
          name: content.fileName,
          source: { bytes: Uint8Array.from(Buffer.from(content.data, 'base64')) },
        };
        return { document };
      } else if (isContentText(content)) {
        return {
          text: content.text.trim(),
        };
      } else {
        return undefined;
      }
    })
    .filter((content) => content !== undefined);
}

function convertToolResultContent(content: ToolResultContent): ToolResultContentBlock[] {
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
        const image: ImageBlock = {
          format: content.mimeType.split('/')[1] as ImageFormat,
          source: { bytes: Uint8Array.from(Buffer.from(content.data, 'base64')) },
        };
        return { image };
      } else {
        return {
          text: content.text.trim(),
        };
      }
    });
}

export function getBedrockApiArgs(
  args: AIRequestHelperArgs,
  aiModelMode: ModelMode
): {
  system: SystemContentBlock[] | undefined;
  messages: Message[];
  tools: Tool[] | undefined;
  tool_choice: ToolChoice | undefined;
} {
  const { messages: chatMessages, toolName, source } = args;

  const { systemMessages, promptMessages } = getSystemPromptMessages(chatMessages);
  const system: SystemContentBlock[] = systemMessages.map((message) => ({ text: message.trim() }));
  const messages: Message[] = promptMessages.reduce<Message[]>((acc, message) => {
    if (isInternalMessage(message)) {
      return acc;
    } else if (isAIPromptMessage(message)) {
      const bedrockMessage: Message = {
        role: message.role,
        content: [
          ...message.content
            .filter((content) => content.type === 'text' && !!content.text.trim())
            .map((content) => ({
              text: content.text.trim(),
            })),
          ...message.toolCalls.map((toolCall) => ({
            toolUse: {
              toolUseId: toolCall.id,
              name: toolCall.name,
              input: toolCall.arguments ? JSON.parse(toolCall.arguments) : {},
            },
          })),
        ],
      };
      return [...acc, bedrockMessage];
    } else if (isToolResultMessage(message)) {
      const bedrockMessage: Message = {
        role: message.role,
        content: [
          ...message.content.map((toolResult) => ({
            toolResult: {
              toolUseId: toolResult.id,
              content: convertToolResultContent(toolResult.content),
              status: 'success' as const,
            },
          })),
        ],
      };
      return [...acc, bedrockMessage];
    } else if (message.content) {
      const bedrockMessage: Message = {
        role: message.role,
        content: convertContent(message.content),
      };
      return [...acc, bedrockMessage];
    } else {
      return acc;
    }
  }, []);

  if (messages.length === 0) {
    throw new EmptyMessagesError();
  }

  const tools = getBedrockTools(source, aiModelMode, toolName);
  const tool_choice = tools?.length ? getBedrockToolChoice(toolName) : undefined;

  return { system, messages, tools, tool_choice };
}

function getBedrockTools(source: AISource, aiModelMode: ModelMode, toolName?: AITool): Tool[] | undefined {
  const tools = getAIToolsInOrder().filter(([name, toolSpec]) => {
    if (!toolSpec.aiModelModes.includes(aiModelMode)) {
      return false;
    }
    if (toolName === undefined) {
      return toolSpec.sources.includes(source);
    }
    return name === toolName;
  });

  if (tools.length === 0) {
    return undefined;
  }

  const bedrockTools: Tool[] = tools.map(
    ([name, { description, parameters: input_schema }]): Tool => ({
      toolSpec: {
        name,
        description,
        inputSchema: {
          json: input_schema,
        },
      },
    })
  );

  return bedrockTools;
}

function getBedrockToolChoice(toolName?: AITool): ToolChoice {
  return toolName === undefined ? { auto: {} } : { tool: { name: toolName } };
}

export async function parseBedrockStream(
  chunks: AsyncIterable<ConverseStreamOutput> | never[],
  modelKey: BedrockModelKey,
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
    if (chunk.metadata) {
      usage.inputTokens = Math.max(usage.inputTokens, chunk.metadata.usage?.inputTokens ?? 0);
      usage.outputTokens = Math.max(usage.outputTokens, chunk.metadata.usage?.outputTokens ?? 0);
    }

    if (!response?.writableEnded) {
      if (chunk.contentBlockStart) {
        // tool use start
        if (chunk.contentBlockStart.start && chunk.contentBlockStart.start.toolUse) {
          const toolCall = {
            id: chunk.contentBlockStart.start.toolUse.toolUseId ?? v4(),
            name: chunk.contentBlockStart.start.toolUse.name ?? '',
            arguments: '',
            loading: true,
          };
          responseMessage.toolCalls.push(toolCall);
        }
      }
      // tool use stop
      else if (chunk.contentBlockStop) {
        let toolCall = responseMessage.toolCalls.pop();
        if (toolCall) {
          toolCall = { ...toolCall, loading: false };
          responseMessage.toolCalls.push(toolCall);
        }
      } else if (chunk.contentBlockDelta) {
        if (chunk.contentBlockDelta.delta) {
          // text delta
          if ('text' in chunk.contentBlockDelta.delta && chunk.contentBlockDelta.delta.text) {
            const currentContent = { ...(responseMessage.content.pop() ?? createTextContent('')) };
            currentContent.text += chunk.contentBlockDelta.delta.text;
            responseMessage.content.push(currentContent);
          }

          // tool use delta
          if ('toolUse' in chunk.contentBlockDelta.delta && chunk.contentBlockDelta.delta.toolUse) {
            const toolCall = {
              ...(responseMessage.toolCalls.pop() ?? {
                id: '',
                name: '',
                arguments: '',
                loading: true,
              }),
            };
            toolCall.arguments += chunk.contentBlockDelta.delta.toolUse.input ?? '';
            responseMessage.toolCalls.push(toolCall);
          }
        }
      }

      response?.write(`data: ${JSON.stringify(responseMessage)}\n\n`);
    } else {
      break;
    }
  }

  responseMessage.content = responseMessage.content.filter((content) => content.text !== '');

  if (responseMessage.content.length === 0 && responseMessage.toolCalls.length === 0) {
    throw new Error('Empty response');
  }

  if (responseMessage.toolCalls.some((toolCall) => toolCall.loading)) {
    responseMessage.toolCalls = responseMessage.toolCalls.map((toolCall) => ({
      ...toolCall,
      loading: false,
    }));
  }

  response?.write(`data: ${JSON.stringify(responseMessage)}\n\n`);
  if (!response?.writableEnded) {
    response?.end();
  }

  return { responseMessage, usage };
}

export function parseBedrockResponse(
  result: ConverseResponse,
  modelKey: BedrockModelKey,
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

  result.output?.message?.content?.forEach((contentBlock) => {
    if ('text' in contentBlock && contentBlock.text) {
      responseMessage.content.push(createTextContent(contentBlock.text.trim()));
    }

    if ('toolUse' in contentBlock && contentBlock.toolUse) {
      responseMessage.toolCalls.push({
        id: contentBlock.toolUse.toolUseId ?? v4(),
        name: contentBlock.toolUse.name ?? '',
        arguments: JSON.stringify(contentBlock.toolUse.input),
        loading: false,
      });
    }
  });

  if (responseMessage.content.length === 0 && responseMessage.toolCalls.length === 0) {
    throw new Error('Empty response');
  }

  response?.json(responseMessage);

  const usage: AIUsage = {
    inputTokens: result.usage?.inputTokens ?? 0,
    outputTokens: result.usage?.outputTokens ?? 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };

  return { responseMessage, usage };
}
