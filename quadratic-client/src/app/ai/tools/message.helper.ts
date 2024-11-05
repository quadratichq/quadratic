import {
  AIModel,
  AIPromptMessage,
  AnthropicPromptMessage,
  BedrockPromptMessage,
  ChatMessage,
  OpenAIPromptMessage,
  SystemMessage,
} from 'quadratic-shared/typesAndSchemasAI';
import { isAnthropicModel, isBedrockModel, isOpenAIModel } from './model.helper';

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

  if (isBedrockModel(model)) {
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

  if (isAnthropicModel(model)) {
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

  if (isOpenAIModel(model)) {
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
