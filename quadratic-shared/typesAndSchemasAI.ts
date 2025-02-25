import { AIToolSchema } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { z } from 'zod';

const AIProvidersSchema = z
  .enum(['bedrock', 'bedrock-anthropic', 'anthropic', 'openai', 'xai'])
  .default('bedrock-anthropic');

const BedrockModelSchema = z
  .enum([
    'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
    'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    'us.meta.llama3-2-90b-instruct-v1:0',
    'mistral.mistral-large-2407-v1:0',
  ])
  .default('us.anthropic.claude-3-5-sonnet-20241022-v2:0');
export type BedrockModel = z.infer<typeof BedrockModelSchema>;

const BedrockAnthropicModelSchema = z
  .enum([
    'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
    'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    'us.anthropic.claude-3-5-haiku-20241022-v1:0',
  ])
  .default('us.anthropic.claude-3-5-sonnet-20241022-v2:0');
export type BedrockAnthropicModel = z.infer<typeof BedrockAnthropicModelSchema>;

const AnthropicModelSchema = z
  .enum(['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'])
  .default('claude-3-5-sonnet-20241022');
export type AnthropicModel = z.infer<typeof AnthropicModelSchema>;

const OpenAIModelSchema = z
  .enum(['gpt-4o-2024-11-20', 'o1-2024-12-17', 'o3-mini-2025-01-31'])
  .default('gpt-4o-2024-11-20');
export type OpenAIModel = z.infer<typeof OpenAIModelSchema>;

const XAIModelSchema = z.enum(['grok-2-1212', 'grok-beta']).default('grok-2-1212');
export type XAIModel = z.infer<typeof XAIModelSchema>;

const AIModelSchema = z.union([
  BedrockModelSchema,
  BedrockAnthropicModelSchema,
  AnthropicModelSchema,
  OpenAIModelSchema,
  XAIModelSchema,
]);
export type AIModel = z.infer<typeof AIModelSchema>;

const ModelConfigSchema = z.object({
  model: AIModelSchema,
  displayName: z.string(),
  temperature: z.number(),
  max_tokens: z.number(),
  canStream: z.boolean(),
  canStreamWithToolCalls: z.boolean(),
  enabled: z.boolean(),
  provider: AIProvidersSchema,
  strickParams: z.boolean().optional(),
  thinking: z.boolean().optional(),
  thinkingTemperature: z.number().optional(),
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
const UserPromptContextTypeSchema = z.literal('userPrompt');

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
    // convert single string to array with text object
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
          type: z.literal('thinking'),
          text: z.string(),
          signature: z.string(),
        })
      )
      .or(
        z.object({
          type: z.literal('redacted_thinking'),
          text: z.string(),
        })
      )
  )
);

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

export const AIRequestBodySchema = z.object({
  chatId: z.string().uuid(),
  fileUuid: z.string().uuid(),
  source: z.enum(['AIAssistant', 'AIAnalyst', 'AIResearcher', 'GetChatName', 'GetFileName']),
  model: AIModelSchema,
  messages: z.array(ChatMessageSchema),
  useStream: z.boolean(),
  useTools: z.boolean(),
  toolName: AIToolSchema.optional(),
  useToolsPrompt: z.boolean().optional(),
  language: CodeCellTypeSchema.optional(),
  useQuadraticContext: z.boolean().optional(),
  thinking: z.boolean(),
});
export type AIRequestBody = z.infer<typeof AIRequestBodySchema>;
export type AIRequestHelperArgs = Omit<AIRequestBody, 'chatId' | 'fileUuid' | 'source' | 'model'>;
