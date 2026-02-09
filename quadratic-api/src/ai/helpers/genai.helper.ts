import type { GenerateContentResponse, Schema } from '@google/genai';
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
  createTextContent,
  getSystemPromptMessages,
  isAIPromptMessage,
  isContentFile,
  isContentText,
  isInternalMessage,
  isToolResultMessage,
} from 'quadratic-shared/ai/helpers/message.helper';
import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import type {
  AIRequestHelperArgs,
  AIToolArgs,
  AIToolArgsArray,
  AIToolArgsPrimitive,
  AIUsage,
  Content,
  GeminiAIModelKey,
  ModelMode,
  ParsedAIResponse,
  TextContent,
  ToolResultContent,
  VertexAIModelKey,
} from 'quadratic-shared/typesAndSchemasAI';
import { v4 } from 'uuid';
import { getFilteredTools } from './tools';

function convertContent(content: Content): Part[] {
  return content
    .filter((content) => {
      // Filter out empty text
      if ('text' in content && !content.text.trim()) return false;
      // Filter out empty data (images, PDFs, files)
      if ('data' in content && !content.data) return false;
      return true;
    })
    .map((content) => {
      if (isContentText(content)) {
        return { text: content.text.trim() };
      } else if (isContentFile(content)) {
        return {
          inlineData: {
            data: content.data,
            mimeType: content.mimeType,
          },
        };
      } else {
        return undefined;
      }
    })
    .filter((content) => content !== undefined);
}

function convertToolResultContent(content: ToolResultContent): string {
  return content
    .filter((content): content is TextContent => isContentText(content) && !!content.text.trim())
    .map((content) => content.text.trim())
    .join('\n');
}

export function getGenAIApiArgs(
  args: AIRequestHelperArgs,
  aiModelMode: ModelMode
): {
  system: GenAIContent | undefined;
  messages: GenAIContent[];
  tools: Tool[] | undefined;
  tool_choice: ToolConfig | undefined;
} {
  const { messages: chatMessages, toolName, source, agentType } = args;

  const { systemMessages, promptMessages } = getSystemPromptMessages(chatMessages);

  const system: GenAIContent | undefined =
    systemMessages.length > 0
      ? {
          role: 'user',
          parts: systemMessages.map((message) => ({ text: message.trim() })),
        }
      : undefined;

  // First pass: collect all valid tool call IDs from assistant messages
  // This is needed to filter out orphaned tool results (e.g., when user aborts mid-tool-call)
  const validToolCallIds = new Set<string>();
  for (const message of promptMessages) {
    if (isAIPromptMessage(message)) {
      for (const toolCall of message.toolCalls) {
        validToolCallIds.add(toolCall.id);
      }
    }
  }

  // Second pass: collect all tool result IDs that exist
  // This is needed to filter out orphaned tool calls (e.g., when chat is forked mid-tool-call)
  const existingToolResultIds = new Set<string>();
  for (const message of promptMessages) {
    if (isToolResultMessage(message)) {
      for (const toolResult of message.content) {
        existingToolResultIds.add(toolResult.id);
      }
    }
  }

  const messages: GenAIContent[] = promptMessages.reduce<GenAIContent[]>((acc, message) => {
    if (isInternalMessage(message)) {
      return acc;
    } else if (isAIPromptMessage(message)) {
      // Filter out tool calls that don't have corresponding tool results
      const validToolCalls = message.toolCalls.filter((toolCall) => existingToolResultIds.has(toolCall.id));

      const genaiMessage: GenAIContent = {
        role: 'model',
        parts: [
          ...message.content
            .filter((content) => isContentText(content) && !!content.text.trim())
            .map((content) => ({
              text: content.text.trim(),
            })),
          ...validToolCalls.map((toolCall) => ({
            functionCall: {
              name: toolCall.name,
              args: toolCall.arguments ? JSON.parse(toolCall.arguments) : {},
            },
          })),
        ],
      };
      return [...acc, genaiMessage];
    } else if (isToolResultMessage(message)) {
      // Filter out tool results that reference non-existent tool call IDs
      // This can happen when user aborts mid-tool-call and tool calls are cleared
      const validToolResults = message.content.filter((toolResult) => validToolCallIds.has(toolResult.id));

      // Skip entirely if no valid tool results remain
      if (validToolResults.length === 0) {
        return acc;
      }

      const genaiMessage: GenAIContent = {
        role: message.role,
        parts: [
          ...validToolResults.map((toolResult) => ({
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

  const tools = getGenAITools(source, aiModelMode, toolName, agentType);
  const tool_choice = tools?.length ? getGenAIToolChoice(toolName) : undefined;

  return { system, messages, tools, tool_choice };
}

function handleMultipleTypes(parameter: AIToolArgsPrimitive): Schema {
  const types = parameter.type as string[];

  // Check if it's a simple nullable type (e.g., ['boolean', 'null'] or ['string', 'null'])
  if (types.length === 2 && types.includes('null')) {
    const nonNullType = types.find((t) => t !== 'null');
    if (nonNullType) {
      const baseSchema = convertSingleType(nonNullType);
      return {
        ...baseSchema,
        nullable: true,
        description: parameter.description,
      };
    }
  }

  // For more complex union types, use anyOf
  return {
    anyOf: types.map((type) => convertSingleType(type)),
    description: parameter.description,
  };
}

function convertSingleType(type: string): Schema {
  switch (type) {
    case 'string':
      return { type: Type.STRING };
    case 'number':
      return { type: Type.NUMBER };
    case 'boolean':
      return { type: Type.BOOLEAN };
    case 'null':
      return { type: Type.NULL };
    default:
      throw new Error(`Unknown type: ${type}`);
  }
}

function convertParametersToGenAISchema(parameter: AIToolArgsPrimitive | AIToolArgsArray | AIToolArgs): Schema {
  // Handle array of types (union types)
  if (Array.isArray(parameter.type)) {
    return handleMultipleTypes(parameter as AIToolArgsPrimitive);
  }

  switch (parameter.type) {
    case 'object':
      return {
        type: Type.OBJECT,
        properties: Object.fromEntries(
          Object.entries(parameter.properties).map(([key, value]) => [key, convertParametersToGenAISchema(value)])
        ),
        required: parameter.required,
      };
    case 'array':
      return {
        type: Type.ARRAY,
        items: convertParametersToGenAISchema(parameter.items),
      };
    case 'string':
      return {
        type: Type.STRING,
        description: parameter.description,
      };
    case 'number':
      return {
        type: Type.NUMBER,
        description: parameter.description,
      };
    case 'boolean':
      return {
        type: Type.BOOLEAN,
        description: parameter.description,
      };
    case 'null':
      return {
        type: Type.NULL,
        description: parameter.description,
      };
    default:
      throw new Error(`Unknown parameter type: ${parameter.type}`);
  }
}

function getGenAITools(
  source: AIRequestHelperArgs['source'],
  aiModelMode: ModelMode,
  toolName?: AITool,
  agentType?: AIRequestHelperArgs['agentType']
): Tool[] | undefined {
  let hasWebSearchInternal = toolName === AITool.WebSearchInternal;

  // Get filtered tools using centralized function
  const allFilteredTools = getFilteredTools({ source, aiModelMode, toolName, agentType });

  // Additional GenAI-specific filtering for WebSearchInternal
  const tools = allFilteredTools.filter(([name]) => {
    if (name === AITool.WebSearchInternal) {
      hasWebSearchInternal = true;
      return false;
    }
    return true;
  });

  if (tools.length === 0 && !hasWebSearchInternal) {
    return undefined;
  }

  const genaiTools: Tool[] = [
    {
      functionDeclarations: tools.map(
        ([name, { description, parameters }]): FunctionDeclaration => ({
          name,
          description,
          parameters: convertParametersToGenAISchema(parameters),
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
  modelKey: VertexAIModelKey | GeminiAIModelKey,
  isOnPaidPlan: boolean,
  exceededBillingLimit: boolean,
  response?: Response
): Promise<ParsedAIResponse> {
  const responseMessage: ApiTypes['/v0/ai/chat.POST.response'] = {
    role: 'assistant',
    content: [],
    contextType: 'userPrompt',
    toolCalls: [],
    modelKey,
    isOnPaidPlan,
    exceededBillingLimit,
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
      usage.outputTokens = Math.max(usage.outputTokens, chunk.usageMetadata.candidatesTokenCount ?? 0);
      usage.cacheReadTokens = Math.max(usage.cacheReadTokens, chunk.usageMetadata.cachedContentTokenCount ?? 0);
    }

    if (!response?.writableEnded) {
      const candidate = chunk.candidates?.[0];

      // text and tool calls
      for (const part of candidate?.content?.parts ?? []) {
        if (part.text?.trim()) {
          // thinking text
          if (part.thought) {
            let currentContent = responseMessage.content.pop();
            if (currentContent?.type !== 'google_thinking') {
              if (currentContent?.text.trim()) {
                responseMessage.content.push(currentContent);
              }
              currentContent = {
                type: 'google_thinking',
                text: '',
              };
            }
            currentContent.text += part.text;
            responseMessage.content.push(currentContent);
          }
          // chat text
          else {
            let currentContent = responseMessage.content.pop();
            if (currentContent?.type !== 'text') {
              if (currentContent?.text.trim()) {
                responseMessage.content.push(currentContent);
              }
              currentContent = createTextContent('');
            }
            currentContent.text += part.text;
            responseMessage.content.push(currentContent);
          }
        }

        // tool call
        if (part.functionCall?.name) {
          responseMessage.toolCalls.push({
            id: part.functionCall.id ?? v4(),
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
    throw new Error('Empty response');
  }

  if (responseMessage.toolCalls.some((toolCall) => toolCall.loading)) {
    responseMessage.toolCalls.forEach((toolCall) => {
      toolCall.loading = false;
    });
  }

  // Include usage in the final response
  responseMessage.usage = usage;

  response?.write(`data: ${JSON.stringify(responseMessage)}\n\n`);

  if (!response?.writableEnded) {
    response?.end();
  }

  return { responseMessage, usage };
}

export function parseGenAIResponse(
  result: GenerateContentResponse,
  modelKey: VertexAIModelKey | GeminiAIModelKey,
  isOnPaidPlan: boolean,
  exceededBillingLimit: boolean,
  response?: Response
): ParsedAIResponse {
  const responseMessage: ApiTypes['/v0/ai/chat.POST.response'] = {
    role: 'assistant',
    content: [],
    contextType: 'userPrompt',
    toolCalls: [],
    modelKey,
    isOnPaidPlan,
    exceededBillingLimit,
  };

  const candidate = result?.candidates?.[0];

  // text and tool calls
  candidate?.content?.parts?.forEach((message) => {
    if (message.text) {
      responseMessage.content.push(createTextContent(message.text.trim()));
    } else if (message.functionCall?.name) {
      responseMessage.toolCalls.push({
        id: message.functionCall.id ?? v4(),
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
    throw new Error('Empty response');
  }

  const usage: AIUsage = {
    inputTokens: (result.usageMetadata?.promptTokenCount ?? 0) - (result.usageMetadata?.cachedContentTokenCount ?? 0),
    outputTokens: result.usageMetadata?.candidatesTokenCount ?? 0,
    cacheReadTokens: result.usageMetadata?.cachedContentTokenCount ?? 0,
    cacheWriteTokens: 0,
  };

  // Include usage in the response
  responseMessage.usage = usage;

  response?.json(responseMessage);

  return { responseMessage, usage };
}
