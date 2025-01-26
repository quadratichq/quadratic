import { AIToolSchema } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { z } from 'zod';

const AIProvidersSchema = z.enum(['bedrock', 'bedrock-anthropic', 'anthropic', 'openai']).default('openai');
export type AIProviders = z.infer<typeof AIProvidersSchema>;

const BedrockModelSchema = z
  .enum([
    'anthropic.claude-3-5-sonnet-20241022-v2:0',
    'ai21.jamba-1-5-large-v1:0',
    'cohere.command-r-plus-v1:0',
    'us.meta.llama3-2-90b-instruct-v1:0',
    'mistral.mistral-large-2407-v1:0',
  ])
  .default('anthropic.claude-3-5-sonnet-20241022-v2:0');
export type BedrockModel = z.infer<typeof BedrockModelSchema>;

const BedrockAnthropicModelSchema = z
  .enum(['anthropic.claude-3-5-sonnet-20241022-v2:0'])
  .default('anthropic.claude-3-5-sonnet-20241022-v2:0');
export type BedrockAnthropicModel = z.infer<typeof BedrockAnthropicModelSchema>;

const AnthropicModelSchema = z.enum(['claude-3-5-sonnet-20241022']).default('claude-3-5-sonnet-20241022');
export type AnthropicModel = z.infer<typeof AnthropicModelSchema>;

const OpenAIModelSchema = z.enum(['gpt-4o-2024-11-20', 'o1-preview']).default('gpt-4o-2024-11-20');
export type OpenAIModel = z.infer<typeof OpenAIModelSchema>;

const AIModelSchema = z.union([BedrockModelSchema, AnthropicModelSchema, OpenAIModelSchema]);
export type AIModel = z.infer<typeof AIModelSchema>;

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
]);
const ToolResultContextTypeSchema = z.literal('toolResult');
const UserPromptContextTypeSchema = z.literal('userPrompt');
const ContextTypeSchema = z.union([
  InternalContextTypeSchema,
  ToolResultContextTypeSchema,
  UserPromptContextTypeSchema,
]);
export type ContextType = z.infer<typeof ContextTypeSchema>;

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
export type AIMessageInternal = z.infer<typeof AIMessageInternalSchema>;

export const AIMessagePromptSchema = z.object({
  role: z.literal('assistant'),
  content: z.string(),
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

const BedrockPromptMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.array(
    z
      .object({ text: z.string() })
      .or(
        z.object({
          toolUse: z.object({
            toolUseId: z.string(),
            name: z.string(),
            input: z.object({}),
          }),
        })
      )
      .or(
        z.object({
          toolResult: z.object({
            toolUseId: z.string(),
            content: z.array(z.object({ text: z.string() })),
            status: z.enum(['error', 'success']).optional(),
          }),
        })
      )
  ),
});
export type BedrockPromptMessage = z.infer<typeof BedrockPromptMessageSchema>;

const AnthropicPromptMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().or(
    z.array(
      z
        .object({ type: z.literal('text'), text: z.string() })
        .or(z.object({ type: z.literal('tool_use'), id: z.string(), name: z.string(), input: z.record(z.unknown()) }))
        .or(
          z.object({
            type: z.literal('tool_result'),
            tool_use_id: z.string(),
            content: z
              .string()
              .or(z.array(z.object({ type: z.literal('text'), text: z.string() })))
              .optional(),
            is_error: z.boolean().optional(),
          })
        )
    )
  ),
});
export type AnthropicPromptMessage = z.infer<typeof AnthropicPromptMessageSchema>;

const OpenAIPromptMessageSchema = z
  .object({
    role: z.literal('system'),
    content: z.string().or(z.array(z.object({ type: z.literal('text'), text: z.string() }))),
  })
  .or(
    z
      .object({
        role: z.literal('user'),
        content: z.string().or(z.array(z.object({ type: z.literal('text'), text: z.string() }))),
      })
      .or(
        z.object({
          role: z.literal('assistant'),
          content: z.string().or(z.array(z.object({ type: z.literal('text'), text: z.string() }))),
          tool_calls: z
            .array(
              z.object({
                id: z.string(),
                type: z.literal('function'),
                function: z.object({ name: z.string(), arguments: z.string() }),
              })
            )
            .optional(),
        })
      )
      .or(
        z.object({
          role: z.literal('tool'),
          tool_call_id: z.string(),
          content: z.string().or(z.array(z.object({ type: z.literal('text'), text: z.string() }))),
        })
      )
  );
export type OpenAIPromptMessage = z.infer<typeof OpenAIPromptMessageSchema>;

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

const BedrockToolSchema = z.object({
  toolSpec: z.object({
    name: z.string(),
    description: z.string(),
    inputSchema: z.object({
      json: z.object({
        type: z.literal('object'),
        properties: z.record(AIToolArgsSchema),
        required: z.array(z.string()),
      }),
    }),
  }),
});
export type BedrockTool = z.infer<typeof BedrockToolSchema>;

const BedrockToolChoiceSchema = z
  .object({ auto: z.object({}) })
  .or(z.object({ any: z.object({}) }))
  .or(z.object({ tool: z.object({ name: z.string() }) }));
export type BedrockToolChoice = z.infer<typeof BedrockToolChoiceSchema>;

const BedrockRequestBodySchema = z.object({
  model: BedrockModelSchema,
  system: z.array(z.object({ text: z.string() })),
  messages: z.array(BedrockPromptMessageSchema),
  tools: z.array(BedrockToolSchema).optional(),
  tool_choice: BedrockToolChoiceSchema.optional(),
});
export type BedrockRequestBody = z.infer<typeof BedrockRequestBodySchema>;

const AnthropicToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  input_schema: z
    .object({
      type: z.literal('object'),
      properties: z.record(AIToolArgsSchema),
      required: z.array(z.string()),
    })
    .and(z.record(z.unknown())),
});
export type AnthropicTool = z.infer<typeof AnthropicToolSchema>;

const AnthropicToolChoiceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('auto') }),
  z.object({ type: z.literal('any') }),
  z.object({ type: z.literal('tool'), name: z.string() }),
]);
export type AnthropicToolChoice = z.infer<typeof AnthropicToolChoiceSchema>;

const AnthropicRequestBodySchema = z.object({
  model: AnthropicModelSchema,
  system: z.string().or(z.array(z.object({ type: z.literal('text'), text: z.string() }))),
  messages: z.array(AnthropicPromptMessageSchema),
  tools: z.array(AnthropicToolSchema).optional(),
  tool_choice: AnthropicToolChoiceSchema.optional(),
});
export type AnthropicRequestBody = z.infer<typeof AnthropicRequestBodySchema>;

const BedrockAnthropicRequestBodySchema = z.object({
  model: BedrockAnthropicModelSchema,
  system: z.string().or(z.array(z.object({ type: z.literal('text'), text: z.string() }))),
  messages: z.array(AnthropicPromptMessageSchema),
  tools: z.array(AnthropicToolSchema).optional(),
  tool_choice: AnthropicToolChoiceSchema.optional(),
});
export type BedrockAnthropicRequestBody = z.infer<typeof BedrockAnthropicRequestBodySchema>;

const OpenAIToolSchema = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.object({
      type: z.literal('object'),
      properties: z.record(AIToolArgsSchema),
      required: z.array(z.string()),
      additionalProperties: z.boolean(),
    }),
    strict: z.boolean(),
  }),
});
export type OpenAITool = z.infer<typeof OpenAIToolSchema>;

const OpenAIToolChoiceSchema = z.union([
  z.literal('auto'),
  z.literal('none'),
  z.object({
    type: z.literal('function'),
    function: z.object({ name: z.string() }),
  }),
]);
export type OpenAIToolChoice = z.infer<typeof OpenAIToolChoiceSchema>;

const OpenAIRequestBodySchema = z.object({
  model: OpenAIModelSchema,
  messages: z.array(OpenAIPromptMessageSchema),
  tools: z.array(OpenAIToolSchema).optional(),
  tool_choice: OpenAIToolChoiceSchema.optional(),
});
export type OpenAIRequestBody = z.infer<typeof OpenAIRequestBodySchema>;

const CodeCellTypeSchema = z.enum(['Python', 'Javascript', 'Formula', 'Connection', 'Import', 'AIResearcher']);
export type CodeCellType = z.infer<typeof CodeCellTypeSchema>;

export const AIRequestBodySchema = z.object({
  chatId: z.string().uuid(),
  fileUuid: z.string().uuid(),
  source: z.enum(['AIAssistant', 'AIAnalyst', 'AIResearcher', 'GetChatName', 'GetFileName']),
  model: z.union([BedrockModelSchema, AnthropicModelSchema, OpenAIModelSchema]),
  messages: z.array(ChatMessageSchema),
  useStream: z.boolean().optional(),
  useTools: z.boolean().optional(),
  toolName: AIToolSchema.optional(),
  useToolsPrompt: z.boolean().optional(),
  language: CodeCellTypeSchema.optional(),
  useQuadraticContext: z.boolean().optional(),
});
export type AIRequestBody = z.infer<typeof AIRequestBodySchema>;
export type AIRequestHelperArgs = Omit<AIRequestBody, 'chatId' | 'fileUuid' | 'source' | 'model'>;

const AIModelToolSchema = BedrockToolSchema.or(AnthropicToolSchema).or(OpenAIToolSchema);
export type AIModelTool = z.infer<typeof AIModelToolSchema>;

const AIModelToolChoiceSchema = BedrockToolChoiceSchema.or(AnthropicToolChoiceSchema).or(OpenAIToolChoiceSchema);
export type AIModelToolChoice = z.infer<typeof AIModelToolChoiceSchema>;

const AIPromptMessageSchema = BedrockPromptMessageSchema.or(AnthropicPromptMessageSchema).or(OpenAIPromptMessageSchema);
export type AIPromptMessage = z.infer<typeof AIPromptMessageSchema>;

export const ExaSearchRequestBodySchema = z.object({
  query: z.string(),
  type: z.enum(['auto', 'neural', 'keyword']),
  numResults: z.number().min(1).max(25).optional(),
  livecrawl: z.enum(['never', 'fallback', 'always']),
  useAutoprompt: z.boolean(),
  text: z.boolean(),
  highlights: z.boolean(),
  summary: z.boolean(),
  categories: z
    .enum(['company', 'research paper', 'news', 'github', 'tweet', 'movie', 'song', 'personal site', 'pdf'])
    .optional(),
  includeText: z.array(z.string()),
  excludeText: z.array(z.string()),
  includeDomains: z.array(z.string()),
  excludeDomains: z.array(z.string()),
  startPublishedDate: z.string(),
  endPublishedDate: z.string(),
});
export type ExaSearchRequestBody = z.infer<typeof ExaSearchRequestBodySchema>;

export const ExaSearchResultSchema = z.object({
  id: z.string(),
  title: z.string().nullable().optional(),
  url: z.string(),
  publishedDate: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  score: z.number().nullable().optional(),
  text: z.string().nullable().optional(),
  highlights: z.array(z.string()).nullable().optional(),
  highlightScores: z.array(z.number()).nullable().optional(),
  summary: z.string().nullable().optional(),
  favicon: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
});
export type ExaSearchResult = z.infer<typeof ExaSearchResultSchema>;

export const ExaSearchResponseSchema = z.object({
  results: z.array(ExaSearchResultSchema),
  autopromptString: z.string().nullable().optional(),
});
export type ExaSearchResponse = z.infer<typeof ExaSearchResponseSchema>;
