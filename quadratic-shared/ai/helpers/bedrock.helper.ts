import type { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type {
  AIAutoCompleteRequestBody,
  BedrockAutoCompleteRequestBody,
  BedrockPromptMessage,
  BedrockTool,
  BedrockToolChoice,
} from 'quadratic-shared/typesAndSchemasAI';
import { getSystemPromptMessages } from './message.helper';

export function getBedrockApiArgs(
  args: Omit<AIAutoCompleteRequestBody, 'model'>
): Omit<BedrockAutoCompleteRequestBody, 'model'> {
  const { messages: chatMessages, useTools, toolName } = args;

  const { systemMessages, promptMessages } = getSystemPromptMessages(chatMessages);
  const system = systemMessages.map((message) => ({ text: message }));
  const messages: BedrockPromptMessage[] = promptMessages.map<BedrockPromptMessage>((message) => {
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

  const tools = getBedrockTools(useTools, toolName);
  const tool_choice = getBedrockToolChoice(useTools, toolName);

  return { system, messages, tools, tool_choice };
}

function getBedrockTools(useTools?: boolean, toolName?: AITool): BedrockTool[] | undefined {
  if (!useTools) {
    return undefined;
  }

  const tools = Object.entries(aiToolsSpec).filter(([name, toolSpec]) => {
    if (toolName === undefined) {
      return !toolSpec.internalTool;
    }
    return name === toolName;
  });

  const bedrockTools: BedrockTool[] = tools.map(
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

  return bedrockTools;
}

function getBedrockToolChoice(useTools?: boolean, name?: AITool): BedrockToolChoice | undefined {
  if (!useTools) {
    return undefined;
  }

  const toolChoice: BedrockToolChoice = name === undefined ? { auto: {} } : { tool: { name } };
  return toolChoice;
}
