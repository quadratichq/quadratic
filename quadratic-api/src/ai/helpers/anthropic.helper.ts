import type Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, TextBlockParam, Tool, ToolChoice } from '@anthropic-ai/sdk/resources';
import type { Stream } from '@anthropic-ai/sdk/streaming';
import type { Response } from 'express';
import { getSystemPromptMessages } from 'quadratic-shared/ai/helpers/message.helper';
import type { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type {
  AIMessagePrompt,
  AIRequestBody,
  AnthropicModel,
  BedrockAnthropicModel,
  ParsedAIResponse,
} from 'quadratic-shared/typesAndSchemasAI';
import { calculateUsage } from './usage.helper';

export function getAnthropicApiArgs(args: Omit<AIRequestBody, 'chatId' | 'fileUuid' | 'source' | 'model'>): {
  system: string | TextBlockParam[] | undefined;
  messages: MessageParam[];
  tools: Tool[] | undefined;
  tool_choice: ToolChoice | undefined;
} {
  const { messages: chatMessages, useTools, toolName } = args;

  const { systemMessages, promptMessages } = getSystemPromptMessages(chatMessages);
  const system = systemMessages.join('\n\n');
  const messages: MessageParam[] = promptMessages.reduce<MessageParam[]>((acc, message) => {
    if (message.role === 'assistant' && message.contextType === 'userPrompt' && message.toolCalls.length > 0) {
      const anthropicMessages: MessageParam[] = [
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
      const anthropicMessages: MessageParam[] = [
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
      const anthropicMessages: MessageParam[] = [
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

function getAnthropicTools(useTools?: boolean, toolName?: AITool): Tool[] | undefined {
  if (!useTools) {
    return undefined;
  }

  const tools = Object.entries(aiToolsSpec).filter(([name, toolSpec]) => {
    if (toolName === undefined) {
      return !toolSpec.internalTool;
    }
    return name === toolName;
  });

  const anthropicTools: Tool[] = tools.map(
    ([name, { description, parameters: input_schema }]): Tool => ({
      name,
      description,
      input_schema,
    })
  );

  return anthropicTools;
}

function getAnthropicToolChoice(useTools?: boolean, name?: AITool): ToolChoice | undefined {
  if (!useTools) {
    return undefined;
  }

  const toolChoice: ToolChoice = name === undefined ? { type: 'auto' } : { type: 'tool', name };
  return toolChoice;
}

export async function parseAnthropicStream(
  chunks: Stream<Anthropic.Messages.RawMessageStreamEvent>,
  response: Response,
  model: AnthropicModel | BedrockAnthropicModel
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
  let cache_read_tokens = 0;
  let cache_write_tokens = 0;

  for await (const chunk of chunks) {
    if (!response.writableEnded) {
      switch (chunk.type) {
        case 'content_block_start':
          if (chunk.content_block.type === 'text') {
            responseMessage.content += chunk.content_block.text;
          } else if (chunk.content_block.type === 'tool_use') {
            const toolCalls = [...responseMessage.toolCalls];
            const toolCall = {
              id: chunk.content_block.id,
              name: chunk.content_block.name,
              arguments: '',
              loading: true,
            };
            toolCalls.push(toolCall);
            responseMessage.toolCalls = toolCalls;
          }
          break;
        case 'content_block_delta':
          if (chunk.delta.type === 'text_delta') {
            responseMessage.content += chunk.delta.text;
          } else if (chunk.delta.type === 'input_json_delta') {
            const toolCalls = [...responseMessage.toolCalls];
            const toolCall = {
              ...(toolCalls.pop() ?? {
                id: '',
                name: '',
                arguments: '',
                loading: true,
              }),
            };
            toolCall.arguments += chunk.delta.partial_json;
            toolCalls.push(toolCall);
            responseMessage.toolCalls = toolCalls;
          }
          break;
        case 'content_block_stop':
          {
            const toolCalls = [...responseMessage.toolCalls];
            const toolCall = toolCalls.pop();
            if (toolCall) {
              toolCalls.push({ ...toolCall, loading: false });
              responseMessage.toolCalls = toolCalls;
            }
          }
          break;
        case 'message_start':
          if (chunk.message.usage) {
            input_tokens = Math.max(input_tokens, chunk.message.usage.input_tokens);
            output_tokens = Math.max(output_tokens, chunk.message.usage.output_tokens);
            cache_read_tokens = Math.max(cache_read_tokens, chunk.message.usage.cache_read_input_tokens ?? 0);
            cache_write_tokens = Math.max(cache_write_tokens, chunk.message.usage.cache_creation_input_tokens ?? 0);
          }
          break;
        case 'message_delta':
          if (chunk.usage) {
            output_tokens = Math.max(output_tokens, chunk.usage.output_tokens);
          }
          break;
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

  const usage = calculateUsage({ model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens });

  return { responseMessage, usage };
}

export function parseAnthropicResponse(
  result: Anthropic.Messages.Message,
  response: Response,
  model: AnthropicModel | BedrockAnthropicModel
): ParsedAIResponse {
  const responseMessage: AIMessagePrompt = {
    role: 'assistant',
    content: '',
    contextType: 'userPrompt',
    toolCalls: [],
    model,
  };

  result.content?.forEach(
    (message: { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: unknown }) => {
      switch (message.type) {
        case 'text':
          responseMessage.content += message.text;
          break;
        case 'tool_use':
          responseMessage.toolCalls = [
            ...responseMessage.toolCalls,
            {
              id: message.id,
              name: message.name,
              arguments: JSON.stringify(message.input),
              loading: false,
            },
          ];
          break;
        default:
          console.error(`Invalid AI response: ${JSON.stringify(message)}`);
      }
    }
  );

  if (!responseMessage.content) {
    responseMessage.content =
      responseMessage.toolCalls.length > 0 ? '' : "I'm sorry, I don't have a response for that.";
  }

  response.json(responseMessage);

  const input_tokens = result.usage.input_tokens;
  const output_tokens = result.usage.output_tokens;
  const cache_read_tokens = result.usage.cache_read_input_tokens ?? 0;
  const cache_write_tokens = result.usage.cache_creation_input_tokens ?? 0;
  const usage = calculateUsage({ model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens });

  return { responseMessage, usage };
}
