import { AIToolSchema } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { z } from 'zod';

const AIProvidersSchema = z.enum([
  'vertexai-anthropic',
  'bedrock-anthropic',
  'anthropic',
  'openai',
  'xai',
  'vertexai',
  'bedrock',
]);
const VertexAnthropicModelSchema = z.enum(['claude-3-7-sonnet@20250219', 'claude-3-5-sonnet-v2@20241022']);
const VertexAIModelSchema = z.enum([
  'gemini-2.5-pro-preview-05-06',
  'gemini-2.0-flash-thinking-exp-01-21',
  'gemini-2.0-flash-001',
  'gemini-2.5-flash-preview-04-17'
]);
const BedrockAnthropicModelSchema = z.enum([
  'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
  'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
  'us.anthropic.claude-3-5-haiku-20241022-v1:0',
]);
const BedrockModelSchema = z.enum(['us.deepseek.r1-v1:0']);
const AnthropicModelSchema = z.enum(['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022']);
const OpenAIModelSchema = z.enum([
  'ft:gpt-4.1-mini-2025-04-14:quadratic::BYv7cTdE',
  'gpt-4.1-mini-2025-04-14',
  'gpt-4.1-2025-04-14',
  'o4-mini-2025-04-16',
  'o3-2025-04-16',
]);
const XAIModelSchema = z.enum(['grok-3-beta']);
const AIModelSchema = z.union([
  VertexAnthropicModelSchema,
  VertexAIModelSchema,
  BedrockAnthropicModelSchema,
  BedrockModelSchema,
  AnthropicModelSchema,
  OpenAIModelSchema,
  XAIModelSchema,
]);
export type AIModel = z.infer<typeof AIModelSchema>;

const VertexAIAnthropicModelKeySchema = z.enum([
  'vertexai-anthropic:claude:thinking-toggle-off',
  'vertexai-anthropic:claude:thinking-toggle-on',
  'vertexai-anthropic:claude-3-7-sonnet@20250219',
  'vertexai-anthropic:claude-3-7-sonnet@20250219:thinking',
  'vertexai-anthropic:claude-3-5-sonnet-v2@20241022',
]);
export type VertexAIAnthropicModelKey = z.infer<typeof VertexAIAnthropicModelKeySchema>;

const VertexAIModelKeySchema = z.enum(['vertexai:gemini-2.5-pro-preview-05-06', 'vertexai:gemini-2.0-flash-001', 'vertexai:gemini-2.5-flash-preview-04-17']);
export type VertexAIModelKey = z.infer<typeof VertexAIModelKeySchema>;

const BedrockAnthropicModelKeySchema = z.enum([
  'bedrock-anthropic:claude:thinking-toggle-off',
  'bedrock-anthropic:claude:thinking-toggle-on',
  'bedrock-anthropic:us.anthropic.claude-3-7-sonnet-20250219-v1:0',
  'bedrock-anthropic:us.anthropic.claude-3-7-sonnet-20250219-v1:0:thinking',
  'bedrock-anthropic:us.anthropic.claude-3-5-sonnet-20241022-v2:0',
  'bedrock-anthropic:us.anthropic.claude-3-5-haiku-20241022-v1:0',
]);
export type BedrockAnthropicModelKey = z.infer<typeof BedrockAnthropicModelKeySchema>;

const BedrockModelKeySchema = z.enum(['bedrock:us.deepseek.r1-v1:0']);
export type BedrockModelKey = z.infer<typeof BedrockModelKeySchema>;

const AnthropicModelKeySchema = z.enum([
  'anthropic:claude:thinking-toggle-on',
  'anthropic:claude:thinking-toggle-off',
  'anthropic:claude-3-7-sonnet-20250219',
  'anthropic:claude-3-7-sonnet-20250219:thinking',
  'anthropic:claude-3-5-sonnet-20241022',
]);
export type AnthropicModelKey = z.infer<typeof AnthropicModelKeySchema>;

const OpenAIModelKeySchema = z.enum([
  'openai:ft:gpt-4.1-mini-2025-04-14:quadratic::BYv7cTdE',
  'openai:gpt-4.1-mini-2025-04-14',
  'openai:gpt-4.1-2025-04-14',
  'openai:o4-mini-2025-04-16',
  'openai:o3-2025-04-16',
]);
export type OpenAIModelKey = z.infer<typeof OpenAIModelKeySchema>;

const XAIModelKeySchema = z.enum(['xai:grok-3-beta']);
export type XAIModelKey = z.infer<typeof XAIModelKeySchema>;

const AIModelKeySchema = z.union([
  VertexAIAnthropicModelKeySchema,
  VertexAIModelKeySchema,
  BedrockAnthropicModelKeySchema,
  BedrockModelKeySchema,
  AnthropicModelKeySchema,
  OpenAIModelKeySchema,
  XAIModelKeySchema,
]);
export type AIModelKey = z.infer<typeof AIModelKeySchema>;

const AIRatesSchema = z.object({
  rate_per_million_input_tokens: z.number(),
  rate_per_million_output_tokens: z.number(),
  rate_per_million_cache_read_tokens: z.number(),
  rate_per_million_cache_write_tokens: z.number(),
});
export const AIModelConfigSchema = z
  .object({
    model: AIModelSchema,
    displayName: z.string(),
    temperature: z.number(),
    max_tokens: z.number(),
    canStream: z.boolean(),
    canStreamWithToolCalls: z.boolean(),
    enabled: z.boolean(),
    provider: AIProvidersSchema,
    promptCaching: z.boolean(),
    strictParams: z.boolean().optional(),
    thinking: z.boolean().optional(),
    thinkingTemperature: z.number().optional(),
    thinkingToggle: z.boolean().optional(),
  })
  .extend(AIRatesSchema.shape);
export type AIModelConfig = z.infer<typeof AIModelConfigSchema>;

const InternalContextTypeSchema = z.enum([
  'quadraticDocs',
  'currentFile',
  'otherSheets',
  'currentSheet',
  'connections',
  'visibleData',
  'toolUse',
  'selection',
  'codeCell',
  'tables',
  'files',
]);
const ToolResultContextTypeSchema = z.literal('toolResult');
export type ToolResultContextType = z.infer<typeof ToolResultContextTypeSchema>;
const UserPromptContextTypeSchema = z.literal('userPrompt');
export type UserPromptContextType = z.infer<typeof UserPromptContextTypeSchema>;

const CodeCellLanguageSchema = z.enum(['Python', 'Javascript', 'Formula', 'Import']).or(
  z.object({
    Connection: z.object({
      kind: z.enum(['POSTGRES', 'MYSQL', 'MSSQL', 'SNOWFLAKE']),
      id: z.string(),
    }),
  })
);
const ContextSchema = z.object({
  sheets: z.array(z.string()),
  currentSheet: z.string(),
  selection: z.string().optional(),
  codeCell: z
    .object({
      sheetId: z.string(),
      pos: z.object({
        x: z.number(),
        y: z.number(),
      }),
      language: CodeCellLanguageSchema,
    })
    .optional(),
});
export type Context = z.infer<typeof ContextSchema>;

const TextContentSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});
export type TextContent = z.infer<typeof TextContentSchema>;

export const ImageContentSchema = z.object({
  type: z.literal('data'),
  data: z.string(),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  fileName: z.string(),
});
export type ImageContent = z.infer<typeof ImageContentSchema>;

export const PdfFileContentSchema = z.object({
  type: z.literal('data'),
  data: z.string(),
  mimeType: z.literal('application/pdf'),
  fileName: z.string(),
});
export type PdfFileContent = z.infer<typeof PdfFileContentSchema>;

export const TextFileContentSchema = z.object({
  type: z.literal('data'),
  data: z.string(),
  mimeType: z.literal('text/plain'),
  fileName: z.string(),
});
export type TextFileContent = z.infer<typeof TextFileContentSchema>;

export const FileContentSchema = z.union([ImageContentSchema, PdfFileContentSchema, TextFileContentSchema]);
export type FileContent = z.infer<typeof FileContentSchema>;

const ContentSchema = z.array(z.union([TextContentSchema, FileContentSchema]));
export type Content = z.infer<typeof ContentSchema>;

const SystemMessageSchema = z.object({
  role: z.literal('user'),
  content: z.union([
    z.string().transform((str) => [
      {
        type: 'text' as const,
        text: str,
      },
    ]),
    z.array(TextContentSchema),
  ]),
  contextType: InternalContextTypeSchema,
});
export type SystemMessage = z.infer<typeof SystemMessageSchema>;

const ToolResultContentSchema = z.array(z.union([TextContentSchema, ImageContentSchema]));
export type ToolResultContent = z.infer<typeof ToolResultContentSchema>;
const ToolResultSchema = z.object({
  role: z.literal('user'),
  content: z.array(
    z.object({
      id: z.string(),
      content: ToolResultContentSchema,
    })
  ),
  contextType: ToolResultContextTypeSchema,
});
export type ToolResultMessage = z.infer<typeof ToolResultSchema>;

const convertStringToContent = (val: any): Content => {
  // old chat messages are single strings, being migrated to array of text objects
  if (typeof val === 'string') {
    return val
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => !!line)
      .map((line) => ({ type: 'text', text: line }));
  }
  return val;
};
const UserMessagePromptSchema = z.object({
  role: z.literal('user'),
  content: z.preprocess(convertStringToContent, ContentSchema),
  contextType: UserPromptContextTypeSchema,
  context: ContextSchema.optional(),
});
export type UserMessagePrompt = z.infer<typeof UserMessagePromptSchema>;

const UserMessageSchema = z.union([SystemMessageSchema, ToolResultSchema, UserMessagePromptSchema]);
export type UserMessage = z.infer<typeof UserMessageSchema>;

const AIMessageInternalSchema = z.object({
  role: z.literal('assistant'),
  content: z.array(TextContentSchema),
  contextType: InternalContextTypeSchema,
});

const AIResponseContentSchema = z.array(
  TextContentSchema.or(
    z.object({
      type: z.literal('anthropic_thinking'),
      text: z.string(),
      signature: z.string(),
    })
  ).or(
    z.object({
      type: z.literal('anthropic_redacted_thinking'),
      text: z.string(),
    })
  )
);
export type AIResponseContent = z.infer<typeof AIResponseContentSchema>;

const convertStringToTextContent = (val: any): AIResponseContent => {
  // old chat messages are single strings, being migrated to array of text objects
  if (typeof val === 'string') {
    return val
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => !!line)
      .map((line) => ({ type: 'text', text: line }));
  }
  return val;
};
export const AIMessagePromptSchema = z.object({
  role: z.literal('assistant'),
  content: z.preprocess(convertStringToTextContent, AIResponseContentSchema),
  contextType: UserPromptContextTypeSchema,
  toolCalls: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      arguments: z.string(),
      loading: z.boolean(),
    })
  ),
  model: AIModelSchema,
  fineTuningInput: z.string().optional(),
});
export type AIMessagePrompt = z.infer<typeof AIMessagePromptSchema>;

const AIMessageSchema = z.union([AIMessageInternalSchema, AIMessagePromptSchema]);
export type AIMessage = z.infer<typeof AIMessageSchema>;

const ChatMessageSchema = z.union([UserMessageSchema, AIMessageSchema]);
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  lastUpdated: z.number(),
  messages: z.array(ChatMessageSchema),
});
export type Chat = z.infer<typeof ChatSchema>;

const AIToolArgsSchema: z.ZodType = z.lazy(() =>
  z
    .object({
      type: z.string(),
      description: z.string(),
    })
    .or(
      z.object({
        type: z.literal('array'),
        items: z
          .object({
            type: z.string(),
            description: z.string(),
          })
          .or(AIToolArgsSchema)
          .or(
            z.object({
              type: z.literal('object'),
              properties: z.record(AIToolArgsSchema),
              required: z.array(z.string()),
              additionalProperties: z.boolean(),
            })
          ),
      })
    )
);
export type AIToolArgs = z.infer<typeof AIToolArgsSchema>;

const CodeCellTypeSchema = z.enum(['Python', 'Javascript', 'Formula', 'Connection', 'Import']);
export type CodeCellType = z.infer<typeof CodeCellTypeSchema>;

const AISourceSchema = z.enum([
  'AIAssistant',
  'AIAnalyst',
  'AIResearcher',
  'GetChatName',
  'GetFileName',
  'CodeEditorCompletions',
  'GetUserPromptSuggestions',
  'PDFImport',
]);
export type AISource = z.infer<typeof AISourceSchema>;

export const AIRequestBodySchema = z.object({
  chatId: z.string().uuid(),
  fileUuid: z.string().uuid(),
  source: AISourceSchema,
  modelKey: AIModelKeySchema,
  messages: z.array(ChatMessageSchema),
  useStream: z.boolean(),
  toolName: AIToolSchema.optional(),
  useToolsPrompt: z.boolean(),
  language: CodeCellTypeSchema.optional(),
  useQuadraticContext: z.boolean(),
});
export type AIRequestBody = z.infer<typeof AIRequestBodySchema>;
export type AIRequestHelperArgs = Omit<AIRequestBody, 'chatId' | 'fileUuid' | 'modelKey'>;

const AIUsageSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  cacheReadTokens: z.number(),
  cacheWriteTokens: z.number(),
  source: AISourceSchema.optional(),
  modelKey: AIModelKeySchema.optional(),
  cost: z.number().optional(),
});
export type AIUsage = z.infer<typeof AIUsageSchema>;

export const ParsedAIResponseSchema = z.object({
  responseMessage: AIMessagePromptSchema,
  usage: AIUsageSchema,
});
export type ParsedAIResponse = z.infer<typeof ParsedAIResponseSchema>;
