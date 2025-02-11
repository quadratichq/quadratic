import {
  type ConverseResponse,
  type ConverseStreamOutput,
  type Message,
  type SystemContentBlock,
  type Tool,
  type ToolChoice,
} from '@aws-sdk/client-bedrock-runtime';
import type { Response } from 'express';
import { getSystemPromptMessages } from 'quadratic-shared/ai/helpers/message.helper';
import type { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type {
  AIMessagePrompt,
  AIRequestHelperArgs,
  BedrockModel,
  ParsedAIResponse,
} from 'quadratic-shared/typesAndSchemasAI';
import { calculateUsage } from './usage.helper';

export function getBedrockApiArgs(args: AIRequestHelperArgs): {
  system: SystemContentBlock[] | undefined;
  messages: Message[];
  tools: Tool[] | undefined;
  tool_choice: ToolChoice | undefined;
} {
  const { messages: chatMessages, useTools, toolName } = args;

  const { systemMessages, promptMessages } = getSystemPromptMessages(chatMessages);
  const system: SystemContentBlock[] = systemMessages.map((message) => ({ text: message }));
  const messages: Message[] = promptMessages.map<Message>((message) => {
    if (message.role === 'assistant' && message.contextType === 'userPrompt' && message.toolCalls.length > 0) {
      const bedrockMessage: Message = {
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
      const bedrockMessage: Message = {
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
      const bedrockMessage: Message = {
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

function getBedrockTools(useTools?: boolean, toolName?: AITool): Tool[] | undefined {
  if (!useTools) {
    return undefined;
  }

  const tools = Object.entries(aiToolsSpec).filter(([name, toolSpec]) => {
    if (toolName === undefined) {
      return !toolSpec.internalTool;
    }
    return name === toolName;
  });

  const bedrockTools: Tool[] = tools.map(
    ([name, { description, parameters: input_schema }]): Tool => ({
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

function getBedrockToolChoice(useTools?: boolean, name?: AITool): ToolChoice | undefined {
  if (!useTools) {
    return undefined;
  }

  const toolChoice: ToolChoice = name === undefined ? { auto: {} } : { tool: { name } };
  return toolChoice;
}

export async function parseBedrockStream(
  chunks: AsyncIterable<ConverseStreamOutput> | never[],
  response: Response,
  model: BedrockModel
): Promise<ParsedAIResponse> {
  const responseMessage: AIMessagePrompt = {
    role: 'assistant',
    content: '',
    contextType: 'userPrompt',
    toolCalls: [],
    model,
  };

  let input_tokens = 0;
  let output_tokens = 0;

  for await (const chunk of chunks) {
    if (chunk.metadata) {
      input_tokens = Math.max(input_tokens, chunk.metadata.usage?.inputTokens ?? 0);
      output_tokens = Math.max(output_tokens, chunk.metadata.usage?.outputTokens ?? 0);
    }

    if (!response.writableEnded) {
      if (chunk.contentBlockStart) {
        // tool use start
        if (chunk.contentBlockStart.start && chunk.contentBlockStart.start.toolUse) {
          const toolCalls = [...responseMessage.toolCalls];
          const toolCall = {
            id: chunk.contentBlockStart.start.toolUse.toolUseId ?? '',
            name: chunk.contentBlockStart.start.toolUse.name ?? '',
            arguments: '',
            loading: true,
          };
          toolCalls.push(toolCall);
          responseMessage.toolCalls = toolCalls;
        }
      }
      // tool use stop
      else if (chunk.contentBlockStop) {
        const toolCalls = [...responseMessage.toolCalls];
        let toolCall = toolCalls.pop();
        if (toolCall) {
          toolCall = { ...toolCall, loading: false };
          toolCalls.push(toolCall);
          responseMessage.toolCalls = toolCalls;
        }
      } else if (chunk.contentBlockDelta) {
        if (chunk.contentBlockDelta.delta) {
          // text delta
          if ('text' in chunk.contentBlockDelta.delta) {
            responseMessage.content += chunk.contentBlockDelta.delta.text;
          }
          // tool use delta
          if ('toolUse' in chunk.contentBlockDelta.delta) {
            const toolCalls = [...responseMessage.toolCalls];
            const toolCall = {
              ...(toolCalls.pop() ?? {
                id: '',
                name: '',
                arguments: '',
                loading: true,
              }),
            };
            toolCall.arguments += chunk.contentBlockDelta.delta.toolUse?.input ?? '';
            toolCalls.push(toolCall);
            responseMessage.toolCalls = toolCalls;
          }
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

  const usage = calculateUsage({ model, input_tokens, output_tokens, cache_read_tokens: 0, cache_write_tokens: 0 });

  return { responseMessage, usage };
}

export function parseBedrockResponse(
  result: ConverseResponse,
  response: Response,
  model: BedrockModel
): ParsedAIResponse {
  const responseMessage: AIMessagePrompt = {
    role: 'assistant',
    content: '',
    contextType: 'userPrompt',
    toolCalls: [],
    model,
  };

  result.output?.message?.content?.forEach((contentBlock) => {
    if ('text' in contentBlock) {
      responseMessage.content += contentBlock.text;
    }

    if ('toolUse' in contentBlock) {
      responseMessage.toolCalls = [
        ...responseMessage.toolCalls,
        {
          id: contentBlock.toolUse?.toolUseId ?? '',
          name: contentBlock.toolUse?.name ?? '',
          arguments: JSON.stringify(contentBlock.toolUse?.input ?? ''),
          loading: false,
        },
      ];
    }

    if (!('text' in contentBlock) && !('toolUse' in contentBlock)) {
      console.error(`Invalid AI response: ${JSON.stringify(contentBlock)}`);
    }
  });

  if (!responseMessage.content) {
    responseMessage.content =
      responseMessage.toolCalls.length > 0 ? '' : "I'm sorry, I don't have a response for that.";
  }

  response.json(responseMessage);

  const input_tokens = result.usage?.inputTokens ?? 0;
  const output_tokens = result.usage?.outputTokens ?? 0;
  const usage = calculateUsage({ model, input_tokens, output_tokens, cache_read_tokens: 0, cache_write_tokens: 0 });

  return { responseMessage, usage };
}
