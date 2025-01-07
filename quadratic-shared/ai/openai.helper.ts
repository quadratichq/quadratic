import type { AITool } from 'quadratic-shared/ai/aiToolsSpec';
import { aiToolsSpec } from 'quadratic-shared/ai/aiToolsSpec';
import type {
  AIAutoCompleteRequestBody,
  OpenAIAutoCompleteRequestBody,
  OpenAIPromptMessage,
  OpenAITool,
  OpenAIToolChoice,
} from 'quadratic-shared/typesAndSchemasAI';
import { getSystemPromptMessages } from './message.helper';

export function getOpenAIApiArgs(
  args: Omit<AIAutoCompleteRequestBody, 'model'>
): Omit<OpenAIAutoCompleteRequestBody, 'model'> {
  const { messages: chatMessages, useTools, toolName } = args;

  const { systemMessages, promptMessages } = getSystemPromptMessages(chatMessages);
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

  const tools = getOpenAITools(useTools, toolName);
  const tool_choice = getOpenAIToolChoice(useTools, toolName);

  return { messages: openaiMessages, tools, tool_choice };
}

function getOpenAITools(useTools?: boolean, toolName?: AITool): OpenAITool[] | undefined {
  if (!useTools) {
    return undefined;
  }

  const tools = Object.entries(aiToolsSpec).filter(([name, toolSpec]) => {
    if (toolName === undefined) {
      return !toolSpec.internalTool;
    }
    return name === toolName;
  });

  const openaiTools: OpenAITool[] = tools.map(
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

  return openaiTools;
}

function getOpenAIToolChoice(useTools?: boolean, name?: AITool): OpenAIToolChoice | undefined {
  if (!useTools) {
    return undefined;
  }

  const toolChoice: OpenAIToolChoice = name === undefined ? 'auto' : { type: 'function', function: { name } };
  return toolChoice;
}
