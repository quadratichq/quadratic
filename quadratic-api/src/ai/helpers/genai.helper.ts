import type { GenerateContentResponse } from '@google/genai';
import {
  FunctionCallingConfigMode,
  Type,
  type FunctionDeclaration,
  type Content as GenAIContent,
  type Part,
  type Tool,
  type ToolConfig,
} from '@google/genai';
import type { Response } from 'express';
import {
  getSystemPromptMessages,
  isContentText,
  isInternalMessage,
  isToolResultMessage,
} from 'quadratic-shared/ai/helpers/message.helper';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type {
  AIMessagePrompt,
  AIRequestHelperArgs,
  AISource,
  AIUsage,
  Content,
  GenAIModelKey,
  ParsedAIResponse,
  TextContent,
  ToolResultContent,
} from 'quadratic-shared/typesAndSchemasAI';

function convertContent(content: Content): Part[] {
  return content.map((content) => {
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
  });
}

function convertToolResultContent(content: ToolResultContent): string {
  return content
    .filter((content): content is TextContent => isContentText(content))
    .map((content) => content.text)
    .join('\n');
}

export function getGenAIApiArgs(args: AIRequestHelperArgs): {
  system: GenAIContent | undefined;
  messages: GenAIContent[];
  tools: Tool[] | undefined;
  tool_choice: ToolConfig | undefined;
} {
  const { messages: chatMessages, toolName, source } = args;

  const { systemMessages, promptMessages } = getSystemPromptMessages(chatMessages);

  const system: GenAIContent | undefined =
    systemMessages.length > 0
      ? {
          role: 'user',
          parts: systemMessages.map((message) => ({ text: message })),
        }
      : undefined;

  const messages: GenAIContent[] = promptMessages.reduce<GenAIContent[]>((acc, message) => {
    if (isInternalMessage(message)) {
      return acc;
    } else if (message.role === 'assistant' && message.contextType === 'userPrompt') {
      const genaiMessage: GenAIContent = {
        role: 'model',
        parts: [
          ...message.content
            .filter((content) => content.text && content.type === 'text')
            .map((content) => ({
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
      return [...acc, genaiMessage];
    } else if (isToolResultMessage(message)) {
      const genaiMessage: GenAIContent = {
        role: message.role,
        parts: [
          ...message.content.map((toolResult) => ({
            functionResponse: {
              name: toolResult.id,
              response: { res: convertToolResultContent(toolResult.content) },
            },
          })),
          {
            text: 'Given the above tool calls results, please provide your final answer to the user.',
          },
        ],
      };
      return [...acc, genaiMessage];
    } else if (message.content) {
      const genaiMessage: GenAIContent = {
        role: message.role === 'assistant' ? 'model' : message.role,
        parts: convertContent(message.content),
      };
      return [...acc, genaiMessage];
    } else {
      return acc;
    }
  }, []);

  const tools = getGenAITools(source, toolName);
  const tool_choice = tools?.length ? getGenAIToolChoice(toolName) : undefined;

  return { system, messages, tools, tool_choice };
}

function getGenAITools(source: AISource, toolName?: AITool): Tool[] | undefined {
  let hasWebSearchInternal = toolName === AITool.WebSearchInternal;
  const tools = Object.entries(aiToolsSpec).filter(([name, toolSpec]) => {
    if (toolName === undefined) {
      return toolSpec.sources.includes(source);
    }
    if (name === AITool.WebSearchInternal) {
      hasWebSearchInternal = true;
      return false;
    }
    return name === toolName;
  });

  if (tools.length === 0 && !hasWebSearchInternal) {
    return undefined;
  }

  const genaiTools: Tool[] = [
    {
      functionDeclarations: tools.map(
        ([name, { description, parameters: input_schema }]): FunctionDeclaration => ({
          name,
          description,
          parameters: {
            type: Type.OBJECT,
            properties: input_schema.properties,
            required: input_schema.required,
          },
        })
      ),
      googleSearch: hasWebSearchInternal ? {} : undefined,
    },
  ];

  return genaiTools;
}

function getGenAIToolChoice(toolName?: AITool): ToolConfig {
  return toolName === undefined
    ? { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } }
    : toolName === AITool.WebSearchInternal
      ? { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: ['google_search'] } }
      : { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: [toolName] } };
}

export async function parseGenAIStream(
  result: AsyncGenerator<GenerateContentResponse, any, any>,
  modelKey: GenAIModelKey,
  response?: Response
): Promise<ParsedAIResponse> {
  const responseMessage: AIMessagePrompt = {
    role: 'assistant',
    content: [],
    contextType: 'userPrompt',
    toolCalls: [],
    modelKey,
  };

  response?.write(`data: ${JSON.stringify(responseMessage)}\n\n`);

  const usage: AIUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };

  for await (const chunk of result) {
    if (chunk.usageMetadata) {
      usage.inputTokens = Math.max(
        usage.inputTokens,
        (chunk.usageMetadata?.promptTokenCount ?? 0) - (chunk.usageMetadata?.cachedContentTokenCount ?? 0)
      );
      // Include thinking tokens in output tokens for Gemini models
      usage.outputTokens = Math.max(
        usage.outputTokens,
        (chunk.usageMetadata.candidatesTokenCount ?? 0) + (chunk.usageMetadata.thoughtsTokenCount ?? 0)
      );
      usage.cacheReadTokens = Math.max(usage.cacheReadTokens, chunk.usageMetadata.cachedContentTokenCount ?? 0);
    }

    if (!response?.writableEnded) {
      const candidate = chunk.candidates?.[0];

      // text, thinking, and tool calls
      for (const part of candidate?.content?.parts ?? []) {
        if (part.text !== undefined) {
          const lastContent = responseMessage.content[responseMessage.content.length - 1];

          if ((part as any).thought) {
            // Handle thinking content
            if (lastContent?.type === 'anthropic_thinking') {
              lastContent.text += part.text;
            } else {
              responseMessage.content.push({
                type: 'anthropic_thinking',
                text: part.text,
                signature: '',
              });
            }
          } else {
            // Handle regular text content
            if (lastContent?.type === 'text') {
              lastContent.text += part.text;
            } else {
              responseMessage.content.push({
                type: 'text',
                text: part.text,
              });
            }
          }
        } else if (part.functionCall?.name) {
          responseMessage.toolCalls.push({
            id: part.functionCall.id ?? part.functionCall.name,
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args),
            loading: false,
          });
        }
      }

      // search grounding metadata
      if (candidate?.groundingMetadata && Object.keys(candidate.groundingMetadata).length > 0) {
        responseMessage.content.push({
          type: 'google_search_grounding_metadata',
          text: JSON.stringify(candidate.groundingMetadata),
        });
      }

      response?.write(`data: ${JSON.stringify(responseMessage)}\n\n`);
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

  response?.write(`data: ${JSON.stringify(responseMessage)}\n\n`);

  if (!response?.writableEnded) {
    response?.end();
  }

  return { responseMessage, usage };
}

export function parseGenAIResponse(
  result: GenerateContentResponse,
  modelKey: GenAIModelKey,
  response?: Response
): ParsedAIResponse {
  const responseMessage: AIMessagePrompt = {
    role: 'assistant',
    content: [],
    contextType: 'userPrompt',
    toolCalls: [],
    modelKey,
  };

  const candidate = result?.candidates?.[0];

  // text, thinking, and tool calls
  candidate?.content?.parts?.forEach((message) => {
    if (message.text) {
      if ((message as any).thought) {
        // Handle thinking content
        responseMessage.content.push({
          type: 'anthropic_thinking',
          text: message.text,
          signature: '',
        });
      } else {
        // Handle regular text content
        responseMessage.content.push({
          type: 'text',
          text: message.text,
        });
      }
    } else if (message.functionCall?.name) {
      responseMessage.toolCalls.push({
        id: message.functionCall.id ?? message.functionCall.name,
        name: message.functionCall.name,
        arguments: JSON.stringify(message.functionCall.args),
        loading: false,
      });
    }
  });

  // search grounding metadata
  if (candidate?.groundingMetadata) {
    responseMessage.content.push({
      type: 'google_search_grounding_metadata',
      text: JSON.stringify(candidate?.groundingMetadata),
    });
  }

  if (responseMessage.content.length === 0 && responseMessage.toolCalls.length === 0) {
    responseMessage.content.push({
      type: 'text',
      text: 'Please try again.',
    });
  }

  response?.json(responseMessage);

  const usage: AIUsage = {
    inputTokens: (result.usageMetadata?.promptTokenCount ?? 0) - (result.usageMetadata?.cachedContentTokenCount ?? 0),
    // Include thinking tokens in output tokens for Gemini models
    outputTokens: (result.usageMetadata?.candidatesTokenCount ?? 0) + (result.usageMetadata?.thoughtsTokenCount ?? 0),
    cacheReadTokens: result.usageMetadata?.cachedContentTokenCount ?? 0,
    cacheWriteTokens: 0,
  };

  return { responseMessage, usage };
}
