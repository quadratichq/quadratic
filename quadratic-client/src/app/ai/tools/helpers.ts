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

export const getMessages = (
  model: AnthropicModel | OpenAIModel,
  messages: (UserMessage | AIMessage)[]
): AnthropicPromptMessage[] | OpenAIPromptMessage[] => {
  const isAnthropic = isAnthropicModel(model);
  if (isAnthropic) {
    return messages.map((message) => {
      if (message.role === 'assistant' && message.functionCalls !== undefined) {
        return {
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
            ...message.functionCalls.map((functionCall) => ({
              type: 'tool_use' as const,
              id: functionCall.id,
              name: functionCall.name,
              input: JSON.parse(functionCall.arguments),
            })),
          ],
        };
      } else {
        return {
          role: message.role,
          content: message.content,
        };
      }
    });
  }

  return messages.map((message) => {
    if (message.role === 'assistant' && message.functionCalls !== undefined) {
      return {
        role: message.role,
        content: message.content,
        tool_calls: message.functionCalls.map((functionCall) => ({
          id: functionCall.id,
          type: 'function',
          function: {
            name: functionCall.name,
            arguments: functionCall.arguments,
          },
        })),
      };
    } else {
      return {
        role: message.role,
        content: message.content,
      };
    }
  });
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
      type: 'function',
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
