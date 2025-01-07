import { getSystemPromptMessages } from 'quadratic-shared/ai/helpers/message.helper';
import type { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type {
  AIAutoCompleteRequestBody,
  AnthropicAutoCompleteRequestBody,
  AnthropicPromptMessage,
  AnthropicTool,
  AnthropicToolChoice,
} from 'quadratic-shared/typesAndSchemasAI';

export function getAnthropicApiArgs(
  args: Omit<AIAutoCompleteRequestBody, 'model'>
): Omit<AnthropicAutoCompleteRequestBody, 'model'> {
  const { messages: chatMessages, useTools, toolName } = args;

  const { systemMessages, promptMessages } = getSystemPromptMessages(chatMessages);
  const system = systemMessages.join('\n\n');
  const messages: AnthropicPromptMessage[] = promptMessages.reduce<AnthropicPromptMessage[]>((acc, message) => {
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
  }, []);

  const tools = getAnthropicTools(useTools, toolName);
  const tool_choice = getAnthropicToolChoice(useTools, toolName);

  return { system, messages, tools, tool_choice };
}

function getAnthropicTools(useTools?: boolean, toolName?: AITool): AnthropicTool[] | undefined {
  if (!useTools) {
    return undefined;
  }

  const tools = Object.entries(aiToolsSpec).filter(([name, toolSpec]) => {
    if (toolName === undefined) {
      return !toolSpec.internalTool;
    }
    return name === toolName;
  });

  const anthropicTools: AnthropicTool[] = tools.map(
    ([name, { description, parameters: input_schema }]): AnthropicTool => ({
      name,
      description,
      input_schema,
    })
  );

  return anthropicTools;
}

function getAnthropicToolChoice(useTools?: boolean, name?: AITool): AnthropicToolChoice | undefined {
  if (!useTools) {
    return undefined;
  }

  const toolChoice: AnthropicToolChoice = name === undefined ? { type: 'auto' } : { type: 'tool', name };
  return toolChoice;
}
