import type { Response } from 'express';
import type OpenAI from 'openai';
import type {
  ResponseFunctionToolCall,
  ResponseInput,
  ResponseInputContent,
  ResponseInputItem,
  ResponseOutputItem,
  ResponseReasoningItem,
  Tool,
  ToolChoiceFunction,
  ToolChoiceOptions,
  ToolChoiceTypes,
} from 'openai/resources/responses/responses';
import type { Stream } from 'openai/streaming';
import { getDataBase64String } from 'quadratic-shared/ai/helpers/files.helper';
import {
  getSystemPromptMessages,
  isContentImage,
  isContentOpenAIReasoning,
  isContentText,
  isInternalMessage,
  isToolResultMessage,
} from 'quadratic-shared/ai/helpers/message.helper';
import type { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import type {
  AIRequestHelperArgs,
  AIResponseThinkingContent,
  AISource,
  AIUsage,
  Content,
  ImageContent,
  OpenAIModelKey,
  ParsedAIResponse,
  TextContent,
  ToolResultContent,
} from 'quadratic-shared/typesAndSchemasAI';
import { v4 } from 'uuid';

function convertInputTextContent(content: TextContent): ResponseInputContent {
  return {
    type: 'input_text' as const,
    text: content.text.trim(),
  };
}

function convertImageContent(content: ImageContent): ResponseInputContent {
  return {
    type: 'input_image' as const,
    image_url: getDataBase64String(content),
    detail: 'auto',
  };
}

function convertInputContent(content: Content | ToolResultContent, imageSupport: boolean): Array<ResponseInputContent> {
  return content
    .filter((content) => !('text' in content) || !!content.text.trim())
    .filter(
      (content): content is TextContent | ImageContent =>
        (imageSupport && isContentImage(content)) || isContentText(content)
    )
    .map((content) => {
      if (isContentText(content)) {
        return convertInputTextContent(content);
      } else {
        return convertImageContent(content);
      }
    });
}

export function getOpenAIResponsesApiArgs(
  args: AIRequestHelperArgs,
  strictParams: boolean,
  imageSupport: boolean
): {
  messages: ResponseInput;
  tools: Array<Tool> | undefined;
  tool_choice: ToolChoiceOptions | ToolChoiceTypes | ToolChoiceFunction | undefined;
} {
  const { messages: chatMessages, toolName, source } = args;

  const { systemMessages, promptMessages } = getSystemPromptMessages(chatMessages);
  const messages: Array<ResponseInputItem> = promptMessages.reduce<Array<ResponseInputItem>>((acc, message) => {
    if (isInternalMessage(message)) {
      return acc;
    } else if (message.role === 'assistant' && message.contextType === 'userPrompt') {
      const reasoningItems: ResponseReasoningItem[] = [];
      const openaiMessages: ResponseOutputItem[] = [
        {
          role: message.role,
          content: message.content
            .filter((content) => !('text' in content) || !!content.text.trim())
            .filter((content): content is TextContent | AIResponseThinkingContent => {
              if (isContentOpenAIReasoning(content)) {
                let currentReasoningItem = reasoningItems.pop();
                if (currentReasoningItem?.id !== content.id) {
                  if (currentReasoningItem?.summary?.length || currentReasoningItem?.content?.length) {
                    reasoningItems.push(currentReasoningItem);
                  }
                  currentReasoningItem = {
                    id: content.id,
                    type: 'reasoning' as const,
                    summary: [],
                    content: [],
                  };
                }
                if (content.type === 'openai_reasoning_summary') {
                  currentReasoningItem.summary.push({
                    type: 'summary_text' as const,
                    text: content.text.trim(),
                  });
                } else if (content.type === 'openai_reasoning_content') {
                  if (!currentReasoningItem.content) {
                    currentReasoningItem.content = [];
                  }
                  currentReasoningItem.content.push({
                    type: 'reasoning_text' as const,
                    text: content.text.trim(),
                  });
                }
                return false;
              }

              return isContentText(content);
            })
            .map((content) => ({
              type: 'output_text' as const,
              text: content.text.trim(),
              annotations: [],
            })),
          id: message.id?.startsWith('msg_') ? message.id : `msg_${v4()}`,
          status: 'completed',
          type: 'message',
        },
        ...message.toolCalls.map<ResponseFunctionToolCall>((toolCall) => ({
          id: toolCall.id.startsWith('fc_') ? toolCall.id : `fc_${toolCall.id}`,
          call_id: toolCall.id.startsWith('call_') ? toolCall.id : `call_${toolCall.id}`,
          type: 'function_call' as const,
          name: toolCall.name,
          arguments: toolCall.arguments,
        })),
      ];
      return [...acc, ...openaiMessages];
    } else if (isToolResultMessage(message)) {
      const openaiMessages: ResponseInputItem[] = message.content.map((toolResult) => ({
        id: toolResult.id.startsWith('fc_') ? toolResult.id : `fc_${toolResult.id}`,
        call_id: toolResult.id.startsWith('call_') ? toolResult.id : `call_${toolResult.id}`,
        type: 'function_call_output' as const,
        output: JSON.stringify(convertInputContent(toolResult.content, false)),
      }));
      return [...acc, ...openaiMessages];
    } else if (message.role === 'user') {
      const openaiMessage: ResponseInputItem = {
        role: message.role,
        content: convertInputContent(message.content, imageSupport),
      };
      return [...acc, openaiMessage];
    } else {
      const openaiMessage: ResponseInputItem = {
        role: message.role,
        content: message.content.map((content) => ({
          type: 'output_text' as const,
          text: content.text,
          annotations: [],
        })),
        id: v4(),
        status: 'completed',
        type: 'message',
      };
      return [...acc, openaiMessage];
    }
  }, []);

  const openaiMessages: ResponseInput = [
    {
      role: 'system',
      content: systemMessages.map((message) => ({ type: 'input_text' as const, text: message.trim() })),
    },
    ...messages,
  ];

  const tools = getOpenAITools(source, toolName, strictParams);
  const tool_choice = tools?.length ? getOpenAIToolChoice(toolName) : undefined;

  return { messages: openaiMessages, tools, tool_choice };
}

function getOpenAITools(source: AISource, toolName: AITool | undefined, strictParams: boolean): Tool[] | undefined {
  const tools = Object.entries(aiToolsSpec).filter(([name, toolSpec]) => {
    if (toolName === undefined) {
      return toolSpec.sources.includes(source);
    }
    return name === toolName;
  });

  if (tools.length === 0) {
    return undefined;
  }

  const openaiTools: Tool[] = tools.map(
    ([name, { description, parameters }]): Tool => ({
      type: 'function' as const,
      name,
      description,
      parameters,
      strict: strictParams,
    })
  );

  return openaiTools;
}

function getOpenAIToolChoice(name?: AITool): ToolChoiceOptions | ToolChoiceTypes | ToolChoiceFunction {
  return name === undefined ? 'auto' : { type: 'function', name };
}

export async function parseOpenAIResponsesStream(
  chunks: Stream<OpenAI.Responses.ResponseStreamEvent>,
  modelKey: OpenAIModelKey,
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
    if (!('response' in chunk)) {
      continue;
    }

    if (chunk.response.usage) {
      usage.inputTokens = Math.max(usage.inputTokens, chunk.response.usage.input_tokens);
      usage.outputTokens = Math.max(usage.outputTokens, chunk.response.usage.output_tokens);
      usage.cacheReadTokens = Math.max(
        usage.cacheReadTokens,
        chunk.response.usage.input_tokens_details?.cached_tokens ?? 0
      );
      usage.inputTokens -= usage.cacheReadTokens;
    }

    if (!response?.writableEnded) {
      for (const output of chunk.response.output) {
        switch (output.type) {
          case 'message':
            for (const content of output.content) {
              switch (content.type) {
                case 'output_text':
                  responseMessage.content.push({
                    type: 'text',
                    text: content.text,
                  });
              }
            }
            break;

          case 'function_call':
            responseMessage.toolCalls.push({
              id: output.id ?? `fc_${v4()}`,
              name: output.name,
              arguments: output.arguments,
              loading: false,
            });
            break;

          case 'reasoning':
            for (const reasoning of output.summary) {
              let currentContent = responseMessage.content.pop();
              if (currentContent?.type !== 'openai_reasoning_summary' || currentContent.id !== output.id) {
                if (currentContent?.text) {
                  responseMessage.content.push(currentContent);
                }
                currentContent = {
                  type: 'openai_reasoning_summary',
                  text: '',
                  id: output.id,
                };
              }
              currentContent.text += `\n${reasoning.text}`;
              responseMessage.content.push(currentContent);
            }
            for (const reasoning of output.content ?? []) {
              let currentContent = responseMessage.content.pop();
              if (currentContent?.type !== 'openai_reasoning_content') {
                if (currentContent?.text) {
                  responseMessage.content.push(currentContent);
                }
                currentContent = {
                  type: 'openai_reasoning_content',
                  text: '',
                  id: output.id,
                };
              }
              currentContent.text += `\n${reasoning.text}`;
              responseMessage.content.push(currentContent);
            }
            break;
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

export function parseOpenAIResponsesResponse(
  result: OpenAI.Responses.Response,
  modelKey: OpenAIModelKey,
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

  for (const output of result.output) {
    switch (output.type) {
      case 'message':
        responseMessage.id = output.id;
        output.content.forEach((content) => {
          switch (content.type) {
            case 'output_text':
              responseMessage.content.push({
                type: 'text',
                text: content.text.trim(),
              });
              break;
          }
        });
        break;
      case 'function_call':
        responseMessage.toolCalls.push({
          id: output.id ?? v4(),
          name: output.name,
          arguments: output.arguments,
          loading: false,
        });
        break;
    }
  }

  if (responseMessage.content.length === 0 && responseMessage.toolCalls.length === 0) {
    responseMessage.content.push({
      type: 'text',
      text: 'Please try again.',
    });
  }

  response?.json(responseMessage);

  const cacheReadTokens = result.usage?.input_tokens_details.cached_tokens ?? 0;
  const usage: AIUsage = {
    inputTokens: (result.usage?.input_tokens ?? 0) - cacheReadTokens,
    outputTokens: result.usage?.output_tokens ?? 0,
    cacheReadTokens,
    cacheWriteTokens: 0,
  };

  return { responseMessage, usage };
}
