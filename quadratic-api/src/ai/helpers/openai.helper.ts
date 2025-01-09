import type { Response } from 'express';
import type OpenAI from 'openai';
import type { Stream } from 'openai/streaming';
import { getSystemPromptMessages } from 'quadratic-shared/ai/helpers/message.helper';
import type { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type {
  AIMessagePrompt,
  AIRequestBody,
  OpenAIModel,
  OpenAIPromptMessage,
  OpenAIRequestBody,
  OpenAITool,
  OpenAIToolChoice,
} from 'quadratic-shared/typesAndSchemasAI';

export function getOpenAIApiArgs(args: Omit<AIRequestBody, 'model'>): Omit<OpenAIRequestBody, 'model'> {
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

export async function parseOpenAIStream(
  chunks: Stream<OpenAI.Chat.Completions.ChatCompletionChunk>,
  response: Response,
  model: OpenAIModel
) {
  const responseMessage: AIMessagePrompt = {
    role: 'assistant',
    content: '',
    contextType: 'userPrompt',
    toolCalls: [],
    model,
  };

  for await (const chunk of chunks) {
    if (!response.writableEnded) {
      if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
        // text delta
        if (chunk.choices[0].delta.content) {
          responseMessage.content += chunk.choices[0].delta.content;
        }
        // tool use delta
        else if (chunk.choices[0].delta.tool_calls) {
          chunk.choices[0].delta.tool_calls.forEach((tool_call) => {
            const toolCalls = [...responseMessage.toolCalls];
            let toolCall = toolCalls.pop();
            if (toolCall) {
              toolCall = {
                ...toolCall,
                loading: true,
              };
              toolCalls.push(toolCall);
            }
            if (tool_call.function?.name) {
              // New tool call
              toolCalls.push({
                id: tool_call.id ?? '',
                name: tool_call.function.name,
                arguments: tool_call.function.arguments ?? '',
                loading: true,
              });
            } else {
              // Append to existing tool call
              const currentToolCall = toolCalls.pop() ?? {
                id: '',
                name: '',
                arguments: '',
                loading: true,
              };

              toolCalls.push({
                ...currentToolCall,
                arguments: currentToolCall.arguments + (tool_call.function?.arguments ?? ''),
              });
            }
            responseMessage.toolCalls = toolCalls;
          });
        }
        // tool use stop
        else if (chunk.choices[0].finish_reason === 'tool_calls') {
          responseMessage.toolCalls = responseMessage.toolCalls.map((toolCall) => ({
            ...toolCall,
            loading: false,
          }));
        } else if (chunk.choices[0].delta.refusal) {
          console.warn('Invalid AI response: ', chunk.choices[0].delta.refusal);
        }
      }

      response.write(`data: ${JSON.stringify(responseMessage)}\n\n`);
    } else {
      break;
    }
  }

  if (!responseMessage.content) {
    responseMessage.content =
      responseMessage.toolCalls.length > 0 ? '' : "I'm sorry, I don't have a response for that.";
    response.write(`data: ${JSON.stringify(responseMessage)}\n\n`);
  }

  if (!response.writableEnded) {
    response.end();
  }

  return responseMessage;
}

export function parseOpenAIResponse(
  result: OpenAI.Chat.Completions.ChatCompletion,
  response: Response,
  model: OpenAIModel
): AIMessagePrompt {
  const responseMessage: AIMessagePrompt = {
    role: 'assistant',
    content: '',
    contextType: 'userPrompt',
    toolCalls: [],
    model,
  };

  const message = result.choices[0].message;

  if (message.content) {
    responseMessage.content += message.content;
  } else if (message.tool_calls) {
    message.tool_calls.forEach((toolCall) => {
      switch (toolCall.type) {
        case 'function':
          responseMessage.toolCalls = [
            ...responseMessage.toolCalls,
            {
              id: toolCall.id,
              name: toolCall.function.name,
              arguments: toolCall.function.arguments,
              loading: false,
            },
          ];
          break;
        default:
          throw new Error(`Invalid AI response: ${toolCall}`);
      }
    });
  } else if (message.refusal) {
    throw new Error(`Invalid AI response: ${message.refusal}`);
  }

  if (!responseMessage.content) {
    responseMessage.content =
      responseMessage.toolCalls.length > 0 ? '' : "I'm sorry, I don't have a response for that.";
  }

  response.json(responseMessage);

  return responseMessage;
}
