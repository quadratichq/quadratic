import type {
  Content,
  FunctionDeclaration,
  GenerateContentResult,
  StreamGenerateContentResult,
  Tool,
  ToolConfig,
} from '@google-cloud/vertexai';
import { FunctionCallingMode, SchemaType } from '@google-cloud/vertexai';
import type { Response } from 'express';
import {
  getSystemPromptMessages,
  isContentText,
  isToolResultMessage,
} from 'quadratic-shared/ai/helpers/message.helper';
import { getModelFromModelKey } from 'quadratic-shared/ai/helpers/model.helper';
import type { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type {
  AIMessagePrompt,
  AIRequestHelperArgs,
  AISource,
  AIUsage,
  ParsedAIResponse,
  VertexAIModelKey,
} from 'quadratic-shared/typesAndSchemasAI';

export function getVertexAIApiArgs(args: AIRequestHelperArgs): {
  system: Content | undefined;
  messages: Content[];
  tools: Tool[] | undefined;
  tool_choice: ToolConfig | undefined;
} {
  const { messages: chatMessages, toolName, source } = args;

  const { systemMessages, promptMessages } = getSystemPromptMessages(chatMessages);

  const system: Content | undefined =
    systemMessages.length > 0
      ? {
          role: 'system',
          parts: systemMessages.map((message) => ({ text: message })),
        }
      : undefined;

  const messages: Content[] = promptMessages.reduce<Content[]>((acc, message) => {
    if (message.role === 'assistant' && message.contextType === 'userPrompt') {
      const vertexaiMessage: Content = {
        role: message.role,
        parts: [
          ...message.content.map((content) => ({
            text: content.text,
          })),
          ...message.toolCalls.map((toolCall) => ({
            functionCall: {
              name: toolCall.name,
              args: JSON.parse(toolCall.arguments),
            },
          })),
        ],
      };
      return [...acc, vertexaiMessage];
    } else if (isToolResultMessage(message)) {
      const vertexaiMessage: Content = {
        role: message.role,
        parts: [
          ...message.content.map((toolResult) => ({
            functionResponse: {
              name: toolResult.id,
              response: { res: toolResult.text },
            },
          })),
          {
            text: 'Given the above tool calls results, please provide your final answer to the user.',
          },
        ],
      };
      return [...acc, vertexaiMessage];
    } else if (message.content) {
      const vertexaiMessage: Content = {
        role: message.role,
        parts: message.content.map((content) => {
          if (isContentText(content)) {
            return { text: content.text };
          } else {
            return {
              inlineData: {
                data: content.data,
                mimeType: content.mimeType,
              },
            };
          }
        }),
      };
      return [...acc, vertexaiMessage];
    } else {
      return acc;
    }
  }, []);

  const tools = getVertexAITools(source, toolName);
  const tool_choice = tools?.length ? getVertexAIToolChoice(toolName) : undefined;

  return { system, messages, tools, tool_choice };
}

function getVertexAITools(source: AISource, toolName?: AITool): Tool[] | undefined {
  const tools = Object.entries(aiToolsSpec).filter(([name, toolSpec]) => {
    if (toolName === undefined) {
      return toolSpec.sources.includes(source);
    }
    return name === toolName;
  });

  if (tools.length === 0) {
    return undefined;
  }

  const vertexaiTools: Tool[] = [
    {
      functionDeclarations: tools.map(
        ([name, { description, parameters: input_schema }]): FunctionDeclaration => ({
          name,
          description,
          parameters: {
            type: SchemaType.OBJECT,
            properties: input_schema.properties,
            required: input_schema.required,
          },
        })
      ),
    },
  ];

  return vertexaiTools;
}

function getVertexAIToolChoice(toolName?: AITool): ToolConfig {
  return toolName === undefined
    ? { functionCallingConfig: { mode: FunctionCallingMode.AUTO } }
    : { functionCallingConfig: { mode: FunctionCallingMode.ANY, allowedFunctionNames: [toolName] } };
}

export async function parseVertexAIStream(
  result: StreamGenerateContentResult,
  response: Response,
  modelKey: VertexAIModelKey
): Promise<ParsedAIResponse> {
  const responseMessage: AIMessagePrompt = {
    role: 'assistant',
    content: [],
    contextType: 'userPrompt',
    toolCalls: [],
    model: getModelFromModelKey(modelKey),
  };

  response.write(`data: ${JSON.stringify(responseMessage)}\n\n`);

  const usage: AIUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };

  for await (const chunk of result.stream) {
    if (chunk.usageMetadata) {
      usage.inputTokens = Math.max(usage.inputTokens, chunk.usageMetadata.promptTokenCount ?? 0);
      usage.outputTokens = Math.max(usage.outputTokens, chunk.usageMetadata.candidatesTokenCount ?? 0);
    }

    if (!response.writableEnded) {
      const candidate = chunk.candidates?.[0];
      for (const part of candidate?.content.parts ?? []) {
        if (part.text !== undefined) {
          let currentContent = responseMessage.content.pop();
          if (currentContent?.type !== 'text') {
            if (currentContent?.text) {
              responseMessage.content.push(currentContent);
            }
            currentContent = {
              type: 'text',
              text: '',
            };
          }
          currentContent.text += part.text;
          responseMessage.content.push(currentContent);
        } else if (part.functionCall !== undefined) {
          responseMessage.toolCalls.push({
            id: part.functionCall.name,
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args),
            loading: false,
          });
        } else {
          console.error(`Invalid AI response: ${JSON.stringify(part)}`);
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
      text: 'Please try again.',
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

  return { responseMessage, usage };
}

export function parseVertexAIResponse(
  result: GenerateContentResult,
  response: Response,
  modelKey: VertexAIModelKey
): ParsedAIResponse {
  const responseMessage: AIMessagePrompt = {
    role: 'assistant',
    content: [],
    contextType: 'userPrompt',
    toolCalls: [],
    model: getModelFromModelKey(modelKey),
  };

  const candidate = result.response.candidates?.[0];
  candidate?.content.parts.forEach((message) => {
    if (message.text) {
      responseMessage.content.push({
        type: 'text',
        text: message.text,
      });
    } else if (message.functionCall) {
      responseMessage.toolCalls.push({
        id: message.functionCall.name,
        name: message.functionCall.name,
        arguments: JSON.stringify(message.functionCall.args),
        loading: false,
      });
    } else {
      console.error(`Invalid AI response: ${JSON.stringify(message)}`);
    }
  });

  if (responseMessage.content.length === 0 && responseMessage.toolCalls.length === 0) {
    responseMessage.content.push({
      type: 'text',
      text: 'Please try again.',
    });
  }

  response.json(responseMessage);

  const usage: AIUsage = {
    inputTokens: result.response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: result.response.usageMetadata?.candidatesTokenCount ?? 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };

  return { responseMessage, usage };
}
