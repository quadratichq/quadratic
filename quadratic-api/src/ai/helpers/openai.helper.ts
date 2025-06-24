import type { Response } from 'express';
import type OpenAI from 'openai';
import type {
  ChatCompletionContentPart,
  ChatCompletionContentPartText,
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolChoiceOption,
} from 'openai/resources';
import type { Stream } from 'openai/streaming';
import { getDataBase64String } from 'quadratic-shared/ai/helpers/files.helper';
import {
  getSystemPromptMessages,
  isContentImage,
  isContentText,
  isInternalMessage,
  isToolResultMessage,
} from 'quadratic-shared/ai/helpers/message.helper';
import type { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type {
  AIMessagePrompt,
  AIRequestHelperArgs,
  AISource,
  AIUsage,
  AzureModelKey,
  Content,
  ImageContent,
  OpenAIModelKey,
  ParsedAIResponse,
  TextContent,
  ToolResultContent,
  XAIModelKey,
} from 'quadratic-shared/typesAndSchemasAI';

function convertContent(content: Content): Array<ChatCompletionContentPart> {
  return content
    .filter((content): content is TextContent | ImageContent => isContentText(content) || isContentImage(content))
    .map((content) => {
      if (isContentText(content)) {
        return content;
      } else {
        return {
          type: 'image_url',
          image_url: {
            url: getDataBase64String(content),
          },
        };
      }
    });
}

function convertToolResultContent(content: ToolResultContent): Array<ChatCompletionContentPartText> {
  return content.filter((content): content is TextContent => isContentText(content));
}

export function getOpenAIApiArgs(
  args: AIRequestHelperArgs,
  strictParams: boolean
): {
  messages: ChatCompletionMessageParam[];
  tools: ChatCompletionTool[] | undefined;
  tool_choice: ChatCompletionToolChoiceOption | undefined;
} {
  const { messages: chatMessages, toolName, source } = args;

  const { systemMessages, promptMessages } = getSystemPromptMessages(chatMessages);
  const messages: ChatCompletionMessageParam[] = promptMessages.reduce<ChatCompletionMessageParam[]>((acc, message) => {
    if (isInternalMessage(message)) {
      return acc;
    } else if (message.role === 'assistant' && message.contextType === 'userPrompt') {
      const openaiMessage: ChatCompletionMessageParam = {
        role: message.role,
        content: message.content
          .filter((content) => content.text && content.type === 'text')
          .map((content) => ({
            type: 'text',
            text: content.text,
          })),
        tool_calls:
          message.toolCalls.length > 0
            ? message.toolCalls.map((toolCall) => ({
                id: toolCall.id,
                type: 'function' as const,
                function: {
                  name: toolCall.name,
                  arguments: toolCall.arguments,
                },
              }))
            : undefined,
      };
      return [...acc, openaiMessage];
    } else if (isToolResultMessage(message)) {
      const openaiMessages: ChatCompletionMessageParam[] = message.content.map((toolResult) => ({
        role: 'tool' as const,
        tool_call_id: toolResult.id,
        content: convertToolResultContent(toolResult.content),
      }));
      return [...acc, ...openaiMessages];
    } else if (message.role === 'user') {
      const openaiMessage: ChatCompletionMessageParam = {
        role: message.role,
        content: convertContent(message.content),
      };
      return [...acc, openaiMessage];
    } else {
      const openaiMessage: ChatCompletionMessageParam = {
        role: message.role,
        content: message.content,
      };
      return [...acc, openaiMessage];
    }
  }, []);

  const openaiMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemMessages.map((message) => ({ type: 'text', text: message })) },
    ...messages,
  ];

  const tools = getOpenAITools(source, toolName, strictParams);
  const tool_choice = tools?.length ? getOpenAIToolChoice(toolName) : undefined;

  return { messages: openaiMessages, tools, tool_choice };
}

function getOpenAITools(
  source: AISource,
  toolName: AITool | undefined,
  strictParams: boolean
): ChatCompletionTool[] | undefined {
  const tools = Object.entries(aiToolsSpec).filter(([name, toolSpec]) => {
    if (toolName === undefined) {
      return toolSpec.sources.includes(source);
    }
    return name === toolName;
  });

  if (tools.length === 0) {
    return undefined;
  }

  const openaiTools: ChatCompletionTool[] = tools.map(
    ([name, { description, parameters }]): ChatCompletionTool => ({
      type: 'function' as const,
      function: {
        name,
        description,
        parameters,
        strict: strictParams,
      },
    })
  );

  return openaiTools;
}

function getOpenAIToolChoice(name?: AITool): ChatCompletionToolChoiceOption {
  return name === undefined ? 'auto' : { type: 'function', function: { name } };
}

export async function parseOpenAIStream(
  chunks: Stream<OpenAI.Chat.Completions.ChatCompletionChunk>,
  modelKey: OpenAIModelKey | XAIModelKey | AzureModelKey,
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
    if (chunk.usage) {
      usage.inputTokens = Math.max(usage.inputTokens, chunk.usage.prompt_tokens);
      usage.outputTokens = Math.max(usage.outputTokens, chunk.usage.completion_tokens);
      usage.cacheReadTokens = Math.max(usage.cacheReadTokens, chunk.usage.prompt_tokens_details?.cached_tokens ?? 0);
      usage.inputTokens -= usage.cacheReadTokens;
    }

    if (!response?.writableEnded) {
      if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
        // text delta
        if (chunk.choices[0].delta.content) {
          const currentContent = {
            ...(responseMessage.content.pop() ?? {
              type: 'text',
              text: '',
            }),
          };
          currentContent.text += chunk.choices[0].delta.content ?? '';
          responseMessage.content.push(currentContent);

          responseMessage.toolCalls = responseMessage.toolCalls.map((toolCall) => ({
            ...toolCall,
            loading: false,
          }));
        }
        // tool use delta
        else if (chunk.choices[0].delta.tool_calls) {
          chunk.choices[0].delta.tool_calls.forEach((tool_call) => {
            const toolCall = responseMessage.toolCalls.pop();
            if (toolCall) {
              responseMessage.toolCalls.push({
                ...toolCall,
                loading: true,
              });
            }
            if (tool_call.function?.name) {
              // New tool call
              responseMessage.toolCalls.push({
                id: tool_call.id ?? '',
                name: tool_call.function.name,
                arguments: tool_call.function.arguments ?? '',
                loading: true,
              });
            } else {
              // Append to existing tool call
              const currentToolCall = responseMessage.toolCalls.pop() ?? {
                id: '',
                name: '',
                arguments: '',
                loading: true,
              };

              responseMessage.toolCalls.push({
                ...currentToolCall,
                arguments: currentToolCall.arguments + (tool_call.function?.arguments ?? ''),
              });
            }
          });
        }
        // tool use stop
        else if (chunk.choices[0].finish_reason === 'tool_calls') {
          responseMessage.toolCalls.forEach((toolCall) => {
            toolCall.loading = false;
          });
        }
      }

      response?.write(`data: ${JSON.stringify(responseMessage)}\n\n`);
    } else {
      break;
    }
  }

  responseMessage.content = responseMessage.content.filter((content) => content.text !== '');

  if (responseMessage.content.length === 0 && responseMessage.toolCalls.length === 0) {
    responseMessage.content.push({
      type: 'text',
      text: 'Please try again.',
    });
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

export function parseOpenAIResponse(
  result: OpenAI.Chat.Completions.ChatCompletion,
  modelKey: OpenAIModelKey | XAIModelKey | AzureModelKey,
  response?: Response
): ParsedAIResponse {
  const responseMessage: AIMessagePrompt = {
    role: 'assistant',
    content: [],
    contextType: 'userPrompt',
    toolCalls: [],
    modelKey,
  };

  const message = result.choices[0].message;

  if (message.content) {
    responseMessage.content.push({
      type: 'text',
      text: message.content,
    });
  }

  if (message.tool_calls) {
    message.tool_calls.forEach((toolCall) => {
      if (toolCall.type === 'function') {
        responseMessage.toolCalls.push({
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
          loading: false,
        });
      }
    });
  }

  if (responseMessage.content.length === 0 && responseMessage.toolCalls.length === 0) {
    responseMessage.content.push({
      type: 'text',
      text: 'Please try again.',
    });
  }

  response?.json(responseMessage);

  const cacheReadTokens = result.usage?.prompt_tokens_details?.cached_tokens ?? 0;
  const usage: AIUsage = {
    inputTokens: (result.usage?.prompt_tokens ?? 0) - cacheReadTokens,
    outputTokens: result.usage?.completion_tokens ?? 0,
    cacheReadTokens,
    cacheWriteTokens: 0,
  };

  return { responseMessage, usage };
}
