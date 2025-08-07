import { AIToolSchema } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { z } from 'zod';

const AIProvidersSchema = z.enum([
  'quadratic',
  'vertexai-anthropic',
  'vertexai',
  'geminiai',
  'bedrock-anthropic',
  'bedrock',
  'anthropic',
  'openai',
  'xai',
  'baseten',
  'fireworks',
  'open-router',
  'azure-openai',
]);

const QuadraticModelSchema = z.enum(['quadratic-auto']);
const VertexAnthropicModelSchema = z.enum(['claude-sonnet-4@20250514']);
const VertexAIModelSchema = z.enum(['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash']);
const GenAIModelSchema = z.enum(['gemini-2.5-flash-lite-preview-06-17']);
const BedrockAnthropicModelSchema = z.enum([
  'us.anthropic.claude-sonnet-4-20250514-v1:0',
  'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
  'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
]);
const BedrockModelSchema = z.enum(['us.deepseek.r1-v1:0']);
const AnthropicModelSchema = z.enum([
  'claude-sonnet-4-20250514',
  'claude-3-7-sonnet-20250219',
  'claude-3-5-sonnet-20241022',
]);
const OpenAIModelSchema = z.enum([
  'ft:gpt-4.1-2025-04-14:quadratic::BvusunQW',
  'ft:gpt-4.1-mini-2025-04-14:quadratic::BupmrWcz',
  'ft:gpt-4.1-nano-2025-04-14:quadratic::BuLAij8n',
  'gpt-4.1-2025-04-14',
  'gpt-4.1-mini-2025-04-14',
  'o4-mini-2025-04-16',
  'o3-2025-04-16',
  'gpt-5-2025-08-07',
  'gpt-5-mini-2025-08-07',
]);
const AzureOpenAIModelSchema = z.enum(['gpt-4.1', 'gpt-4.1-mini']);
const XAIModelSchema = z.enum(['grok-4-0709']);
const BasetenModelSchema = z.enum(['moonshotai/Kimi-K2-Instruct', 'Qwen/Qwen3-Coder-480B-A35B-Instruct']);
const FireworksModelSchema = z.enum(['accounts/fireworks/models/qwen3-coder-480b-a35b-instruct']);
const OpenRouterModelSchema = z.enum([
  'deepseek/deepseek-r1-0528',
  'deepseek/deepseek-chat-v3-0324',
  'moonshotai/kimi-k2',
]);
const AIModelSchema = z.union([
  QuadraticModelSchema,
  VertexAnthropicModelSchema,
  VertexAIModelSchema,
  GenAIModelSchema,
  BedrockAnthropicModelSchema,
  BedrockModelSchema,
  AnthropicModelSchema,
  OpenAIModelSchema,
  AzureOpenAIModelSchema,
  XAIModelSchema,
  BasetenModelSchema,
  FireworksModelSchema,
  OpenRouterModelSchema,
]);
export type AIModel = z.infer<typeof AIModelSchema>;

const QuadraticModelKeySchema = z.enum([
  'quadratic:quadratic-auto:thinking-toggle-off',
  'quadratic:quadratic-auto:thinking-toggle-on',
]);
export type QuadraticModelKey = z.infer<typeof QuadraticModelKeySchema>;

const VertexAIAnthropicModelKeySchema = z.enum([
  'vertexai-anthropic:claude-sonnet-4:thinking',
  'vertexai-anthropic:claude-sonnet-4:thinking-toggle-off',
  'vertexai-anthropic:claude-sonnet-4:thinking-toggle-on',
]);
export type VertexAIAnthropicModelKey = z.infer<typeof VertexAIAnthropicModelKeySchema>;

const VertexAIModelKeySchema = z.enum([
  'vertexai:gemini-2.5-pro:thinking-toggle-off',
  'vertexai:gemini-2.5-pro:thinking-toggle-on',
  'vertexai:gemini-2.5-pro:thinking',
  'vertexai:gemini-2.5-flash:thinking-toggle-off',
  'vertexai:gemini-2.5-flash:thinking-toggle-on',
  'vertexai:gemini-2.0-flash',
]);
export type VertexAIModelKey = z.infer<typeof VertexAIModelKeySchema>;

const GeminiAIModelKeySchema = z.enum(['geminiai:gemini-2.5-flash-lite-preview-06-17']);
export type GeminiAIModelKey = z.infer<typeof GeminiAIModelKeySchema>;

const BedrockAnthropicModelKeySchema = z.enum([
  'bedrock-anthropic:claude-sonnet-4:thinking-toggle-off',
  'bedrock-anthropic:claude-sonnet-4:thinking-toggle-on',
  'bedrock-anthropic:claude:thinking-toggle-off',
  'bedrock-anthropic:claude:thinking-toggle-on',
  'bedrock-anthropic:us.anthropic.claude-3-7-sonnet-20250219-v1:0:thinking-toggle-off',
  'bedrock-anthropic:us.anthropic.claude-3-7-sonnet-20250219-v1:0:thinking-toggle-on',
]);
export type BedrockAnthropicModelKey = z.infer<typeof BedrockAnthropicModelKeySchema>;

const BedrockModelKeySchema = z.enum(['bedrock:us.deepseek.r1-v1:0']);
export type BedrockModelKey = z.infer<typeof BedrockModelKeySchema>;

const AnthropicModelKeySchema = z.enum([
  'anthropic:claude-sonnet-4:thinking-toggle-off',
  'anthropic:claude-sonnet-4:thinking-toggle-on',
  'anthropic:claude:thinking-toggle-on',
  'anthropic:claude:thinking-toggle-off',
]);
export type AnthropicModelKey = z.infer<typeof AnthropicModelKeySchema>;

const OpenAIModelKeySchema = z.enum([
  'openai:ft:gpt-4.1-2025-04-14:quadratic::BvusunQW',
  'openai:ft:gpt-4.1-mini-2025-04-14:quadratic::BupmrWcz',
  'openai:ft:gpt-4.1-nano-2025-04-14:quadratic::BuLAij8n',
  'openai:gpt-4.1-2025-04-14',
  'openai:gpt-4.1-mini-2025-04-14',
  'openai:o4-mini-2025-04-16',
  'openai:o3-2025-04-16',
  'openai:gpt-5-2025-08-07',
  'openai:gpt-5-mini-2025-08-07',
]);
export type OpenAIModelKey = z.infer<typeof OpenAIModelKeySchema>;

const AzureOpenAIModelKeySchema = z.enum(['azure-openai:gpt-4.1', 'azure-openai:gpt-4.1-mini']);
export type AzureOpenAIModelKey = z.infer<typeof AzureOpenAIModelKeySchema>;

const XAIModelKeySchema = z.enum(['xai:grok-4-0709']);
export type XAIModelKey = z.infer<typeof XAIModelKeySchema>;

const BasetenModelKeySchema = z.enum([
  'baseten:moonshotai/Kimi-K2-Instruct',
  'baseten:Qwen/Qwen3-Coder-480B-A35B-Instruct',
]);
export type BasetenModelKey = z.infer<typeof BasetenModelKeySchema>;

const FireworksModelKeySchema = z.enum(['fireworks:accounts/fireworks/models/qwen3-coder-480b-a35b-instruct']);
export type FireworksModelKey = z.infer<typeof FireworksModelKeySchema>;

const OpenRouterModelKeySchema = z.enum([
  'open-router:deepseek/deepseek-r1-0528',
  'open-router:deepseek/deepseek-chat-v3-0324',
  'open-router:moonshotai/kimi-k2',
]);
export type OpenRouterModelKey = z.infer<typeof OpenRouterModelKeySchema>;

const AIModelKeySchema = z.union([
  QuadraticModelKeySchema,
  VertexAIAnthropicModelKeySchema,
  VertexAIModelKeySchema,
  GeminiAIModelKeySchema,
  BedrockAnthropicModelKeySchema,
  BedrockModelKeySchema,
  AnthropicModelKeySchema,
  OpenAIModelKeySchema,
  AzureOpenAIModelKeySchema,
  XAIModelKeySchema,
  BasetenModelKeySchema,
  FireworksModelKeySchema,
  OpenRouterModelKeySchema,
]);
export type AIModelKey = z.infer<typeof AIModelKeySchema>;

const AIRatesSchema = z.object({
  rate_per_million_input_tokens: z.number(),
  rate_per_million_output_tokens: z.number(),
  rate_per_million_cache_read_tokens: z.number(),
  rate_per_million_cache_write_tokens: z.number(),
});
export type AIRates = z.infer<typeof AIRatesSchema>;
const ModelModeSchema = z.enum(['disabled', 'fast', 'max']);
export type ModelMode = z.infer<typeof ModelModeSchema>;
export const AIModelConfigSchema = z
  .object({
    model: AIModelSchema,
    backupModel: AIModelKeySchema.optional(),
    displayName: z.string(),
    temperature: z.number(),
    max_tokens: z.number(),
    canStream: z.boolean(),
    canStreamWithToolCalls: z.boolean(),
    mode: ModelModeSchema,
    provider: AIProvidersSchema,
    promptCaching: z.boolean(),
    strictParams: z.boolean().optional(),
    thinking: z.boolean().optional(),
    thinkingToggle: z.boolean().optional(),
    thinkingBudget: z.number().optional(),
    imageSupport: z.boolean(),
    // Sampling parameters
    top_p: z.number().optional(),
    top_k: z.number().optional(),
    min_p: z.number().optional(),
    repetition_penalty: z.number().optional(),
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
  'modelRouter',
  'currentDate',
]);
const ToolResultContextTypeSchema = z.literal('toolResult');
export type ToolResultContextType = z.infer<typeof ToolResultContextTypeSchema>;
const UserPromptContextTypeSchema = z.literal('userPrompt');
export type UserPromptContextType = z.infer<typeof UserPromptContextTypeSchema>;

const CodeCellLanguageSchema = z.enum(['Python', 'Javascript', 'Formula', 'Import']).or(
  z.object({
    Connection: z.object({
      kind: z.enum([
        'POSTGRES',
        'MYSQL',
        'MSSQL',
        'SNOWFLAKE',
        'BIGQUERY',
        'COCKROACHDB',
        'MARIADB',
        'NEON',
        'SUPABASE',
      ]),
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
      lastModified: z
        .number()
        .optional()
        .transform((val) => {
          // lastModified is optional in the context, but required in the code cell
          if (val === undefined) {
            return 0; // default to 0 if not provided
          }
          return val;
        }),
    })
    .optional(),
});
export type Context = z.infer<typeof ContextSchema>;

const TextContentSchema = z.preprocess(
  (val: any) => {
    if (typeof val === 'string') {
      return { type: 'text', text: val.trim() };
    }
    return val;
  },
  z.object({
    type: z.literal('text'),
    text: z.string().transform((val) => val.trim()),
  })
);
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

const GoogleSearchGroundingMetadataSchema = z.object({
  type: z.literal('google_search_grounding_metadata'),
  text: z.string().transform((val) => val.trim()),
});
export type GoogleSearchGroundingMetadata = z.infer<typeof GoogleSearchGroundingMetadataSchema>;

const ContentSchema = z.array(z.union([TextContentSchema, FileContentSchema]));
export type Content = z.infer<typeof ContentSchema>;

const SystemMessageSchema = z.object({
  role: z.literal('user'),
  content: z.preprocess((val) => {
    if (typeof val === 'string') {
      return [{ type: 'text', text: val.trim() }];
    }
    return val;
  }, z.array(TextContentSchema)),
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

const convertStringToContent = (val: any): TextContent[] => {
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
      text: z.string().transform((val) => val.trim()),
      signature: z.string(),
    })
  )
    .or(
      z.object({
        type: z.literal('anthropic_redacted_thinking'),
        text: z.string().transform((val) => val.trim()),
      })
    )
    .or(GoogleSearchGroundingMetadataSchema)
    .or(
      z.object({
        type: z.literal('google_thinking'),
        text: z.string().transform((val) => val.trim()),
      })
    )
);
export type AIResponseContent = z.infer<typeof AIResponseContentSchema>;

const AIToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.string(),
  loading: z.boolean(),
});
export type AIToolCall = z.infer<typeof AIToolCallSchema>;

export const AIMessagePromptSchema = z.preprocess(
  (val: any) => {
    if (typeof val === 'object' && 'model' in val) {
      return {
        ...val,
        modelKey: val.model,
      };
    }
    return val;
  },
  z.object({
    role: z.literal('assistant'),
    content: z.preprocess(convertStringToContent, AIResponseContentSchema),
    contextType: UserPromptContextTypeSchema,
    toolCalls: z.array(AIToolCallSchema),
    modelKey: z.string(),
  })
);
export type AIMessagePrompt = z.infer<typeof AIMessagePromptSchema>;

const AIMessageSchema = z.union([AIMessageInternalSchema, AIMessagePromptSchema]);
export type AIMessage = z.infer<typeof AIMessageSchema>;

const InternalWebSearchContextTypeSchema = z.literal('webSearchInternal');
export type InternalWebSearchContextType = z.infer<typeof InternalWebSearchContextTypeSchema>;

const GoogleSearchContentSchema = z.object({
  source: z.literal('google_search'),
  query: z.string(),
  results: z.array(z.union([TextContentSchema, GoogleSearchGroundingMetadataSchema])),
});
export type GoogleSearchContent = z.infer<typeof GoogleSearchContentSchema>;

const InternalMessageSchema = z.object({
  role: z.literal('internal'),
  contextType: InternalWebSearchContextTypeSchema,
  content: GoogleSearchContentSchema,
});
export type InternalMessage = z.infer<typeof InternalMessageSchema>;

const ChatMessageSchema = z.union([UserMessageSchema, AIMessageSchema, InternalMessageSchema]);
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatMessagesSchema = z.array(ChatMessageSchema);

export const ChatSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  lastUpdated: z.number(),
  messages: ChatMessagesSchema,
});
export type Chat = z.infer<typeof ChatSchema>;

const AIToolPrimitiveTypeSchema = z.enum(['string', 'number', 'boolean', 'null']);
const AIToolArgsPrimitiveSchema = z.object({
  type: AIToolPrimitiveTypeSchema.or(z.array(AIToolPrimitiveTypeSchema)),
  description: z.string(),
});
export type AIToolArgsPrimitive = z.infer<typeof AIToolArgsPrimitiveSchema>;

export type AIToolArgsArray = {
  type: 'array';
  items: AIToolArgsPrimitive | AIToolArgsArray | AIToolArgs;
};
const AIToolArgsArraySchema: z.ZodType<AIToolArgsArray> = z.lazy(() =>
  z.object({
    type: z.literal('array'),
    items: AIToolArgsSchema,
  })
);

export type AIToolArgs = {
  type: 'object';
  properties: Record<string, AIToolArgsPrimitive | AIToolArgsArray | AIToolArgs>;
  required: string[];
  additionalProperties: boolean;
};
const AIToolArgsSchema: z.ZodType<AIToolArgs> = z.lazy(() =>
  z.object({
    type: z.literal('object'),
    properties: z.record(AIToolArgsPrimitiveSchema.or(AIToolArgsArraySchema).or(AIToolArgsSchema)),
    required: z.array(z.string()),
    additionalProperties: z.boolean(),
  })
);

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
  'ModelRouter',
  'WebSearch',
]);
export type AISource = z.infer<typeof AISourceSchema>;

export const AIRequestBodySchema = z.object({
  chatId: z.string().uuid(),
  fileUuid: z.string().uuid(),
  source: AISourceSchema,
  messageSource: z.string(),
  modelKey: AIModelKeySchema,
  messages: z.array(ChatMessageSchema),
  useStream: z.boolean(),
  toolName: AIToolSchema.optional(),
  useToolsPrompt: z.boolean(),
  language: CodeCellTypeSchema.optional(),
  useQuadraticContext: z.boolean(),
});
export type AIRequestBody = z.infer<typeof AIRequestBodySchema>;
export type AIRequestHelperArgs = Omit<AIRequestBody, 'chatId' | 'fileUuid' | 'messageSource' | 'modelKey'>;

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
