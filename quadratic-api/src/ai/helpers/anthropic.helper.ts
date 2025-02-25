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
  XAIModel,
} from 'quadratic-shared/typesAndSchemasAI';

export function getAnthropicApiArgs(
  args: Omit<AIRequestBody, 'chatId' | 'fileUuid' | 'source' | 'model'>,
  thinking: boolean | undefined
): {
  system: TextBlockParam[] | undefined;
  messages: MessageParam[];
  tools: Tool[] | undefined;
  tool_choice: ToolChoice | undefined;
} {
  const { messages: chatMessages, useTools, toolName } = args;

  const { systemMessages, promptMessages } = getSystemPromptMessages(chatMessages);

  // without prompt caching of system messages
  const system: TextBlockParam[] = systemMessages.map((message) => ({
    type: 'text' as const,
    text: message,
  }));

  // with prompt caching of system messages
  // const system: TextBlockParam[] = systemMessages.map((message, index) => ({
  //   type: 'text' as const,
  //   text: message,
  //   ...(index < 4 ? { cache_control: { type: 'ephemeral' } } : {}),
  // }));

  const messages: MessageParam[] = promptMessages.reduce<MessageParam[]>((acc, message) => {
    if (message.role === 'assistant' && message.contextType === 'userPrompt') {
      const anthropicMessage: MessageParam = {
        role: message.role,
        content: [
          ...message.content
            .filter((content) => content.text && (!!thinking || content.type === 'text'))
            .map((content) => {
              if (content.type === 'thinking') {
                return {
                  type: 'thinking' as const,
                  thinking: content.text,
                  signature: content.signature,
                };
              } else if (content.type === 'redacted_thinking') {
                return {
                  type: 'redacted_thinking' as const,
                  data: content.text,
                };
              } else {
                return {
                  type: 'text' as const,
                  text: content.text,
                };
              }
            }),
          ...message.toolCalls.map((toolCall) => ({
            type: 'tool_use' as const,
            id: toolCall.id,
            name: toolCall.name,
            input: JSON.parse(toolCall.arguments),
          })),
        ],
      };
      return [...acc, anthropicMessage];
    } else if (message.role === 'user' && message.contextType === 'toolResult') {
      const anthropicMessages: MessageParam = {
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
      };
      return [...acc, anthropicMessages];
    } else if (message.content) {
      const anthropicMessage: MessageParam = {
        role: message.role,
        content: message.content,
      };
      return [...acc, anthropicMessage];
    } else {
      return acc;
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
  model: BedrockAnthropicModel | AnthropicModel | XAIModel
) {
  const responseMessage: AIMessagePrompt = {
    role: 'assistant',
    content: [],
    contextType: 'userPrompt',
    toolCalls: [],
    model,
  };

  for await (const chunk of chunks) {
    if (!response.writableEnded) {
      if (chunk.type === 'content_block_start') {
        if (chunk.content_block.type === 'text') {
          responseMessage.content.push({
            type: 'text',
            text: chunk.content_block.text ?? '',
          });

          responseMessage.toolCalls.forEach((toolCall) => {
            toolCall.loading = false;
          });
        } else if (chunk.content_block.type === 'tool_use') {
          responseMessage.toolCalls.push({
            id: chunk.content_block.id,
            name: chunk.content_block.name,
            arguments: '',
            loading: true,
          });
        } else if (chunk.content_block.type === 'thinking') {
          responseMessage.content.push({
            type: 'thinking',
            text: chunk.content_block.thinking ?? '',
            signature: chunk.content_block.signature ?? '',
          });
        } else if (chunk.content_block.type === 'redacted_thinking') {
          responseMessage.content.push({
            type: 'redacted_thinking',
            text: chunk.content_block.data ?? '',
          });
        }
      } else if (chunk.type === 'content_block_delta') {
        if (chunk.delta.type === 'text_delta') {
          const currentContent = {
            ...(responseMessage.content.pop() ?? {
              type: 'text',
              text: '',
            }),
          };
          currentContent.text += chunk.delta.text ?? '';
          responseMessage.content.push(currentContent);
        } else if (chunk.delta.type === 'input_json_delta') {
          const toolCall = {
            ...(responseMessage.toolCalls.pop() ?? {
              id: '',
              name: '',
              arguments: '',
              loading: true,
            }),
          };
          toolCall.arguments += chunk.delta.partial_json;
          responseMessage.toolCalls.push(toolCall);
        } else if (chunk.delta.type === 'thinking_delta') {
          const currentContent = {
            ...(responseMessage.content.pop() ?? {
              type: 'thinking',
              text: '',
              signature: '',
            }),
          };
          currentContent.text += chunk.delta.thinking ?? '';
          responseMessage.content.push(currentContent);
        } else if (chunk.delta.type === 'signature_delta') {
          const currentContent = {
            ...(responseMessage.content.pop() ?? {
              type: 'thinking',
              text: '',
              signature: '',
            }),
          };
          if (currentContent.type === 'thinking') {
            currentContent.signature += chunk.delta.signature ?? '';
          }
          responseMessage.content.push(currentContent);
        }
      } else if (chunk.type === 'content_block_stop') {
        const toolCall = responseMessage.toolCalls.pop();
        if (toolCall) {
          responseMessage.toolCalls.push({ ...toolCall, loading: false });
        }
      }

      response.write(`data: ${JSON.stringify(responseMessage)}\n\n`);
    } else {
      break;
    }
  }

  if (responseMessage.content.length === 0 && responseMessage.toolCalls.length === 0) {
    responseMessage.content.push({
      type: 'text',
      text: "I'm sorry, I don't have a response for that.",
    });
  }

  if (responseMessage.toolCalls.some((toolCall) => toolCall.loading)) {
    responseMessage.toolCalls.forEach((toolCall) => {
      toolCall.loading = false;
    });
  }

  response.write(`data: ${JSON.stringify(responseMessage)}\n\n`);

  if (!response.writableEnded) {
    response.end();
  }

  return responseMessage;
}

export function parseAnthropicResponse(
  result: Anthropic.Messages.Message,
  response: Response,
  model: BedrockAnthropicModel | AnthropicModel | XAIModel
): AIMessagePrompt {
  const responseMessage: AIMessagePrompt = {
    role: 'assistant',
    content: [],
    contextType: 'userPrompt',
    toolCalls: [],
    model,
  };

  result.content?.forEach((message) => {
    switch (message.type) {
      case 'text':
        responseMessage.content.push({
          type: 'text',
          text: message.text ?? '',
        });
        break;
      case 'tool_use':
        responseMessage.toolCalls.push({
          id: message.id,
          name: message.name,
          arguments: JSON.stringify(message.input),
          loading: false,
        });
        break;
      case 'thinking':
        responseMessage.content.push({
          type: 'thinking',
          text: message.thinking ?? '',
          signature: message.signature ?? '',
        });
        break;
      case 'redacted_thinking':
        responseMessage.content.push({
          type: 'redacted_thinking',
          text: message.data ?? '',
        });
        break;
      default:
        console.error(`Invalid AI response: ${JSON.stringify(message)}`);
    }
  });

  if (responseMessage.content.length === 0 && responseMessage.toolCalls.length === 0) {
    responseMessage.content.push({
      type: 'text',
      text: "I'm sorry, I don't have a response for that.",
    });
  }

  response.json(responseMessage);

  return responseMessage;
}
