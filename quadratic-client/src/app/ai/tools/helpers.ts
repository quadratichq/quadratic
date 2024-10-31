/**
 * Helpers for converting messages and tools to the format required by the AI API
 * This is used to interface with the AI API, and is not part of the main logic of the app
 * Currently Bedrock, Anthropic and OpenAI are supported
 */

import { MODEL_OPTIONS } from '@/app/ai/MODELS';
import { AITool as AIToolName } from '@/app/ai/tools/aiTools';
import { aiToolsSpec } from '@/app/ai/tools/aiToolsSpec';
import { AI } from '@/shared/constants/routes';
import {
  AIModel,
  AIPromptMessage,
  AITool,
  AIToolChoice,
  AnthropicModel,
  AnthropicPromptMessage,
  AnthropicTool,
  AnthropicToolChoice,
  BedrockModel,
  BedrockPromptMessage,
  BedrockTool,
  BedrockToolChoice,
  ChatMessage,
  OpenAIModel,
  OpenAIPromptMessage,
  OpenAITool,
  OpenAIToolChoice,
  SystemMessage,
} from 'quadratic-shared/typesAndSchemasAI';

export function isBedrockModel(model: AIModel): model is BedrockModel {
  return MODEL_OPTIONS[model].provider === 'bedrock';
}

export function isAnthropicModel(model: AIModel): model is AnthropicModel {
  return MODEL_OPTIONS[model].provider === 'anthropic';
}

export function isOpenAIModel(model: AIModel): model is OpenAIModel {
  return MODEL_OPTIONS[model].provider === 'openai';
}

export function getAIProviderEndpoint(model: AIModel, stream: boolean): string {
  if (isBedrockModel(model)) {
    return stream ? AI.BEDROCK.STREAM : AI.BEDROCK.CHAT;
  }
  if (isAnthropicModel(model)) {
    return stream ? AI.ANTHROPIC.STREAM : AI.ANTHROPIC.CHAT;
  }
  if (isOpenAIModel(model)) {
    return stream ? AI.OPENAI.STREAM : AI.OPENAI.CHAT;
  }
  throw new Error(`Unknown model: ${model}`);
}

export const getSystemMessages = (messages: ChatMessage[]): string[] => {
  const systemMessages: SystemMessage[] = messages.filter<SystemMessage>(
    (message): message is SystemMessage =>
      message.role === 'user' && message.contextType !== 'userPrompt' && message.contextType !== 'toolResult'
  );
  return systemMessages.map((message) => message.content);
};

export const getPromptMessages = (messages: ChatMessage[]): ChatMessage[] => {
  return messages.filter((message) => message.contextType === 'userPrompt' || message.contextType === 'toolResult');
};

export const getMessagesForModel = (
  model: AIModel,
  messages: ChatMessage[]
): { system?: string | { text: string }[]; messages: AIPromptMessage[] } => {
  // send internal context messages as system messages
  const systemMessages: string[] = getSystemMessages(messages);
  const promptMessages = getPromptMessages(messages);

  // send all messages as prompt messages
  // const systemMessages: string[] = [];
  // const promptMessages = messages;

  const isBedrock = isBedrockModel(model);
  if (isBedrock) {
    const bedrockMessages: BedrockPromptMessage[] = promptMessages.map<BedrockPromptMessage>((message) => {
      if (message.role === 'assistant' && message.contextType === 'userPrompt' && message.toolCalls.length > 0) {
        const bedrockMessage: BedrockPromptMessage = {
          role: message.role,
          content: [
            ...(message.content
              ? [
                  {
                    text: message.content,
                  },
                ]
              : []),
            ...message.toolCalls.map((toolCall) => ({
              toolUse: {
                toolUseId: toolCall.id,
                name: toolCall.name,
                input: JSON.parse(toolCall.arguments),
              },
            })),
          ],
        };
        return bedrockMessage;
      } else if (message.role === 'user' && message.contextType === 'toolResult') {
        const bedrockMessage: BedrockPromptMessage = {
          role: message.role,
          content: [
            ...message.content.map((toolResult) => ({
              toolResult: {
                toolUseId: toolResult.id,
                content: [
                  {
                    text: toolResult.content,
                  },
                ],
                status: 'success' as const,
              },
            })),
          ],
        };
        return bedrockMessage;
      } else {
        const bedrockMessage: BedrockPromptMessage = {
          role: message.role,
          content: [
            {
              text: message.content,
            },
          ],
        };
        return bedrockMessage;
      }
    });

    return { messages: bedrockMessages, system: systemMessages.map((message) => ({ text: message })) };
  }

  const isAnthropic = isAnthropicModel(model);
  if (isAnthropic) {
    const anthropicMessages: AnthropicPromptMessage[] = promptMessages.reduce<AnthropicPromptMessage[]>(
      (acc, message) => {
        if (message.role === 'assistant' && message.contextType === 'userPrompt' && message.toolCalls.length > 0) {
          const anthropicMessages: AnthropicPromptMessage[] = [
            ...acc,
            {
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
            },
          ];
          return anthropicMessages;
        } else if (message.role === 'user' && message.contextType === 'toolResult') {
          const anthropicMessages: AnthropicPromptMessage[] = [
            ...acc,
            {
              role: message.role,
              content: [
                ...message.content.map((toolResult) => ({
                  type: 'tool_result' as const,
                  tool_use_id: toolResult.id,
                  content: toolResult.content,
                })),
                {
                  type: 'text' as const,
                  text: 'Given the above tool calls results, please provide your final answer to the user.',
                },
              ],
            },
          ];
          return anthropicMessages;
        } else {
          const anthropicMessages: AnthropicPromptMessage[] = [
            ...acc,
            {
              role: message.role,
              content: message.content,
            },
          ];
          return anthropicMessages;
        }
      },
      []
    );

    return { messages: anthropicMessages, system: systemMessages.join('\n\n') };
  }

  const isOpenAI = isOpenAIModel(model);
  if (isOpenAI) {
    const messages: OpenAIPromptMessage[] = promptMessages.reduce<OpenAIPromptMessage[]>((acc, message) => {
      if (message.role === 'assistant' && message.contextType === 'userPrompt' && message.toolCalls.length > 0) {
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
    }, []);

    const openaiMessages: OpenAIPromptMessage[] = [
      { role: 'system', content: systemMessages.map((message) => ({ type: 'text', text: message })) },
      ...messages,
    ];

    return { messages: openaiMessages };
  }

  throw new Error(`Unknown model: ${model}`);
};

export const getTools = (model: AIModel, toolChoice?: AIToolName): AITool[] => {
  const tools = Object.entries(aiToolsSpec).filter(([name, toolSpec]) => {
    if (toolChoice === undefined) {
      return !toolSpec.internalTool;
    }
    return name === toolChoice;
  });

  const isBedrock = isBedrockModel(model);
  if (isBedrock) {
    return tools.map(
      ([name, { description, parameters: input_schema }]): BedrockTool => ({
        toolSpec: {
          name,
          description,
          inputSchema: {
            json: input_schema,
          },
        },
      })
    );
  }

  const isAnthropic = isAnthropicModel(model);
  if (isAnthropic) {
    return tools.map(
      ([name, { description, parameters: input_schema }]): AnthropicTool => ({
        name,
        description,
        input_schema,
      })
    );
  }

  const isOpenAI = isOpenAIModel(model);
  if (isOpenAI) {
    return tools.map(
      ([name, { description, parameters }]): OpenAITool => ({
        type: 'function' as const,
        function: {
          name,
          description,
          parameters,
          strict: true,
        },
      })
    );
  }

  throw new Error(`Unknown model: ${model}`);
};

export const getToolChoice = (model: AIModel, name?: AIToolName): AIToolChoice => {
  const isBedrock = isBedrockModel(model);
  if (isBedrock) {
    const toolChoice: BedrockToolChoice = name === undefined ? { auto: {} } : { tool: { name } };
    return toolChoice;
  }

  const isAnthropic = isAnthropicModel(model);
  if (isAnthropic) {
    const toolChoice: AnthropicToolChoice = name === undefined ? { type: 'auto' } : { type: 'tool', name };
    return toolChoice;
  }

  const isOpenAI = isOpenAIModel(model);
  if (isOpenAI) {
    const toolChoice: OpenAIToolChoice = name === undefined ? 'auto' : { type: 'function', function: { name } };
    return toolChoice;
  }

  throw new Error(`Unknown model: ${model}`);
};
