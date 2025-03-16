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
const VertexAnthropicModelSchema = z.enum([
  'claude-3-7-sonnet@20250219',
  'claude-3-5-sonnet-v2@20241022',
  'claude-3-5-haiku@20241022',
]);
const BedrockAnthropicModelSchema = z.enum([
  'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
  'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
  'us.anthropic.claude-3-5-haiku-20241022-v1:0',
]);
const AnthropicModelSchema = z.enum([
  'claude-3-7-sonnet-20250219',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
]);
const OpenAIModelSchema = z.enum([
  'gpt-4.5-preview-2025-02-27',
  'gpt-4o-2024-11-20',
  'o1-2024-12-17',
  'o3-mini-2025-01-31',
]);
const XAIModelSchema = z.enum(['grok-2-1212', 'grok-beta']);
const VertexAIModelSchema = z.enum([
  'gemini-2.0-flash-thinking-exp-01-21',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite-001',
  'gemini-1.5-pro-002',
  'gemini-1.5-flash-002',
]);
const BedrockModelSchema = z.enum([
  'us.deepseek.r1-v1:0',
  'us.meta.llama3-2-90b-instruct-v1:0',
  'mistral.mistral-large-2407-v1:0',
]);
const AIModelSchema = z.union([
  VertexAnthropicModelSchema,
  BedrockAnthropicModelSchema,
  AnthropicModelSchema,
  OpenAIModelSchema,
  XAIModelSchema,
  VertexAIModelSchema,
  BedrockModelSchema,
]);
export type AIModel = z.infer<typeof AIModelSchema>;

const VertexAIAnthropicModelKeySchema = z.enum([
  'vertexai-anthropic:claude:thinking-toggle-off',
  'vertexai-anthropic:claude:thinking-toggle-on',
  'vertexai-anthropic:claude-3-7-sonnet@20250219',
  'vertexai-anthropic:claude-3-7-sonnet@20250219:thinking',
  'vertexai-anthropic:claude-3-5-sonnet-v2@20241022',
  'vertexai-anthropic:claude-3-5-haiku@20241022',
]);
export type VertexAIAnthropicModelKey = z.infer<typeof VertexAIAnthropicModelKeySchema>;

const BedrockAnthropicModelKeySchema = z.enum([
  'bedrock-anthropic:claude:thinking-toggle-off',
  'bedrock-anthropic:claude:thinking-toggle-on',
  'bedrock-anthropic:us.anthropic.claude-3-7-sonnet-20250219-v1:0',
  'bedrock-anthropic:us.anthropic.claude-3-7-sonnet-20250219-v1:0:thinking',
  'bedrock-anthropic:us.anthropic.claude-3-5-sonnet-20241022-v2:0',
  'bedrock-anthropic:us.anthropic.claude-3-5-haiku-20241022-v1:0',
]);
export type BedrockAnthropicModelKey = z.infer<typeof BedrockAnthropicModelKeySchema>;

const AnthropicModelKeySchema = z.enum([
  'anthropic:claude:thinking-toggle-on',
  'anthropic:claude:thinking-toggle-off',
  'anthropic:claude-3-7-sonnet-20250219',
  'anthropic:claude-3-7-sonnet-20250219:thinking',
  'anthropic:claude-3-5-sonnet-20241022',
  'anthropic:claude-3-5-haiku-20241022',
]);
export type AnthropicModelKey = z.infer<typeof AnthropicModelKeySchema>;

const OpenAIModelKeySchema = z.enum([
  'openai:gpt-4.5-preview-2025-02-27',
  'openai:gpt-4o-2024-11-20',
  'openai:o1-2024-12-17',
  'openai:o3-mini-2025-01-31',
]);
export type OpenAIModelKey = z.infer<typeof OpenAIModelKeySchema>;

const XAIModelKeySchema = z.enum(['xai:grok-2-1212', 'xai:grok-beta']);
export type XAIModelKey = z.infer<typeof XAIModelKeySchema>;

const VertexAIModelKeySchema = z.enum([
  'vertexai:gemini-2.0-flash-001',
  'vertexai:gemini-2.0-flash-lite-001',
  'vertexai:gemini-1.5-pro-002',
  'vertexai:gemini-1.5-flash-002',
]);
export type VertexAIModelKey = z.infer<typeof VertexAIModelKeySchema>;

const BedrockModelKeySchema = z.enum([
  'bedrock:us.deepseek.r1-v1:0',
  'bedrock:us.meta.llama3-2-90b-instruct-v1:0',
  'bedrock:mistral.mistral-large-2407-v1:0',
]);
export type BedrockModelKey = z.infer<typeof BedrockModelKeySchema>;

const ModelKeySchema = z.union([
  VertexAIAnthropicModelKeySchema,
  BedrockAnthropicModelKeySchema,
  AnthropicModelKeySchema,
  OpenAIModelKeySchema,
  XAIModelKeySchema,
  VertexAIModelKeySchema,
  BedrockModelKeySchema,
]);
export type ModelKey = z.infer<typeof ModelKeySchema>;

const ModelConfigSchema = z.object({
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
});
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

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
]);
const ToolResultContextTypeSchema = z.literal('toolResult');
export type ToolResultContextType = z.infer<typeof ToolResultContextTypeSchema>;
const UserPromptContextTypeSchema = z.literal('userPrompt');
export type UserPromptContextType = z.infer<typeof UserPromptContextTypeSchema>;

const ContextSchema = z.object({
  sheets: z.array(z.string()),
  currentSheet: z.string(),
  selection: z.string().optional(),
});
export type Context = z.infer<typeof ContextSchema>;

const SystemMessageSchema = z.object({
  role: z.literal('user'),
  content: z.string(),
  contextType: InternalContextTypeSchema,
});
export type SystemMessage = z.infer<typeof SystemMessageSchema>;

const ToolResultSchema = z.object({
  role: z.literal('user'),
  content: z.array(
    z.object({
      id: z.string(),
      content: z.string(),
    })
  ),
  contextType: ToolResultContextTypeSchema,
});
export type ToolResultMessage = z.infer<typeof ToolResultSchema>;

const UserMessagePromptSchema = z.object({
  role: z.literal('user'),
  content: z.string(),
  contextType: UserPromptContextTypeSchema,
  context: ContextSchema.optional(),
});
export type UserMessagePrompt = z.infer<typeof UserMessagePromptSchema>;

const UserMessageSchema = z.union([SystemMessageSchema, ToolResultSchema, UserMessagePromptSchema]);
export type UserMessage = z.infer<typeof UserMessageSchema>;

const AIMessageInternalSchema = z.object({
  role: z.literal('assistant'),
  content: z.string(),
  contextType: InternalContextTypeSchema,
});

const ContentSchema = z.preprocess(
  (val) => {
    // old chat messages are single strings, being migrated to array of text objects
    if (typeof val === 'string') {
      return val
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => !!line)
        .map((line) => ({ type: 'text', text: line }));
    }

    return val;
  },
  z.array(
    z
      .object({
        type: z.literal('text'),
        text: z.string(),
      })
      .or(
        z.object({
          type: z.literal('anthropic_thinking'),
          text: z.string(),
          signature: z.string(),
        })
      )
      .or(
        z.object({
          type: z.literal('anthropic_redacted_thinking'),
          text: z.string(),
        })
      )
  )
);
export type Content = z.infer<typeof ContentSchema>;

export const AIMessagePromptSchema = z.object({
  role: z.literal('assistant'),
  content: ContentSchema,
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

const AISourceSchema = z.enum(['AIAssistant', 'AIAnalyst', 'AIResearcher', 'GetChatName', 'GetFileName']);
export type AISource = z.infer<typeof AISourceSchema>;

export const AIRequestBodySchema = z.object({
  chatId: z.string().uuid(),
  fileUuid: z.string().uuid(),
  source: AISourceSchema,
  modelKey: ModelKeySchema,
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
});
export type AIUsage = z.infer<typeof AIUsageSchema>;

const parsedAIResponseSchema = z.object({
  responseMessage: AIMessagePromptSchema,
  usage: AIUsageSchema,
});
export type ParsedAIResponse = z.infer<typeof parsedAIResponseSchema>;
