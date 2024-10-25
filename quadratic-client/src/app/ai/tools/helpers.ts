/**
 * Helpers for converting messages and tools to the format required by the AI API
 * This is used to interface with the AI API, and is not part of the main logic of the app
 * Currently only Anthropic and OpenAI are supported
 */

import { AITool } from '@/app/ai/tools/aiTools';
import { aiToolsSpec } from '@/app/ai/tools/aiToolsSpec';
import {
  AIMessage,
  AnthropicModel,
  AnthropicModelSchema,
  AnthropicPromptMessage,
  AnthropicTool,
  AnthropicToolChoice,
  OpenAIModel,
  OpenAIPromptMessage,
  OpenAITool,
  OpenAIToolChoice,
  UserMessage,
} from 'quadratic-shared/typesAndSchemasAI';

export function isAnthropicModel(model: AnthropicModel | OpenAIModel): model is AnthropicModel {
  return AnthropicModelSchema.safeParse(model).success;
}

export const getMessagesForModel = (
  model: AnthropicModel | OpenAIModel,
  messages: (UserMessage | AIMessage)[]
): AnthropicPromptMessage[] | OpenAIPromptMessage[] => {
  const isAnthropic = isAnthropicModel(model);
  if (isAnthropic) {
    return messages.map<AnthropicPromptMessage>((message) => {
      if (message.role === 'assistant' && message.toolCalls.length > 0) {
        const anthropicMessage: AnthropicPromptMessage = {
          role: message.role,
          content: [
            ...(message.content
              ? [
                  {
                    type: 'text' as const,
                    text: message.content,
                  },
                ]
              : []),
            ...message.toolCalls.map((toolCall) => ({
              type: 'tool_use' as const,
              id: toolCall.id,
              name: toolCall.name,
              input: JSON.parse(toolCall.arguments),
            })),
          ],
        };
        return anthropicMessage;
      } else if (message.role === 'user' && message.contextType === 'toolResult') {
        const anthropicMessage: AnthropicPromptMessage = {
          role: message.role,
          content: [
            ...message.content.map((toolResult) => ({
              type: 'tool_result' as const,
              tool_use_id: toolResult.id,
              content: toolResult.content,
            })),
            {
              type: 'text' as const,
              text: 'Given the above tool calls, please provide your final answer to the user.',
            },
          ],
        };
        return anthropicMessage;
      } else {
        const anthropicMessage: AnthropicPromptMessage = {
          role: message.role,
          content: message.content,
        };
        return anthropicMessage;
      }
    });
  }

  return messages.reduce<OpenAIPromptMessage[]>((acc, message) => {
    if (message.role === 'assistant' && message.toolCalls.length > 0) {
      const openaiMessages: OpenAIPromptMessage[] = [
        ...acc,
        {
          role: message.role,
          content: message.content,
          tool_calls: message.toolCalls.map((toolCall) => ({
            id: toolCall.id,
            type: 'function' as const,
            function: {
              name: toolCall.name,
              arguments: toolCall.arguments,
            },
          })),
        },
      ];
      return openaiMessages;
    } else if (message.role === 'user' && message.contextType === 'toolResult') {
      const openaiMessages: OpenAIPromptMessage[] = [
        ...acc,
        ...message.content.map((toolResult) => ({
          role: 'tool' as const,
          tool_call_id: toolResult.id,
          content: toolResult.content,
        })),
      ];
      return openaiMessages;
    } else {
      const openaiMessages: OpenAIPromptMessage[] = [
        ...acc,
        {
          role: message.role,
          content: message.content,
        },
      ];
      return openaiMessages;
    }
  }, [] as OpenAIPromptMessage[]);
};

export const getTools = (model: AnthropicModel | OpenAIModel): AnthropicTool[] | OpenAITool[] => {
  const isAnthropic = isAnthropicModel(model);
  if (isAnthropic) {
    return Object.entries(aiToolsSpec).map(
      ([name, { description, parameters: input_schema }]): AnthropicTool => ({
        name,
        description,
        input_schema,
      })
    );
  }

  return Object.entries(aiToolsSpec).map(
    ([name, { description, parameters }]): OpenAITool => ({
      type: 'function' as const,
      function: {
        name,
        description,
        parameters: {
          ...parameters,
          additionalProperties: false,
        },
        strict: true,
      },
    })
  );
};

export const getToolChoice = (
  model: AnthropicModel | OpenAIModel,
  name?: AITool
): AnthropicToolChoice | OpenAIToolChoice => {
  const isAnthropic = isAnthropicModel(model);
  if (isAnthropic) {
    const toolChoice: AnthropicToolChoice = name === undefined ? { type: 'auto' } : { type: 'tool', name };
    return toolChoice;
  }

  const toolChoice: OpenAIToolChoice = name === undefined ? 'auto' : { type: 'function', function: { name } };
  return toolChoice;
};
