import { z } from 'zod';

export const AnthropicModelSchema = z.enum(['claude-3-5-sonnet-latest']).default('claude-3-5-sonnet-latest');
export type AnthropicModel = z.infer<typeof AnthropicModelSchema>;

export const OpenAIModelSchema = z.enum(['gpt-4o', 'o1-preview']).default('gpt-4o');
export type OpenAIModel = z.infer<typeof OpenAIModelSchema>;

export const ContextTypeSchema = z.enum([
  'quadraticDocs',
  'connections',
  'allSheets',
  'currentSheet',
  'visibleData',
  'toolUse',
  'selection',
  'codeCell',
  'toolResult',
  'userPrompt',
]);
export type ContextType = z.infer<typeof ContextTypeSchema>;

const ContextSchema = z.object({
  quadraticDocs: z.boolean(),
  connections: z.boolean(),
  allSheets: z.boolean(),
  currentSheet: z.boolean(),
  visibleData: z.boolean(),
  toolUse: z.boolean(),
  selection: z.array(
    z.object({
      sheet_id: z.object({ id: z.string() }),
      min: z.object({ x: z.bigint(), y: z.bigint() }),
      max: z.object({ x: z.bigint(), y: z.bigint() }),
    })
  ),
  codeCell: z
    .object({
      sheetId: z.string(),
      pos: z.object({ x: z.number(), y: z.number() }),
      language: z.enum(['Python', 'Javascript', 'Formula']).or(
        z.object({
          Connection: z.object({ kind: z.enum(['POSTGRES', 'MYSQL', 'MSSQL', 'SNOWFLAKE']), id: z.string() }),
        })
      ),
    })
    .optional(),
});
export type Context = z.infer<typeof ContextSchema>;

const UserMessageInternalSchema = z
  .object({
    role: z.literal('user'),
    content: z.string(),
    contextType: ContextTypeSchema.exclude(['toolResult', 'userPrompt']),
  })
  .or(
    z.object({
      role: z.literal('user'),
      content: z.array(
        z.object({
          id: z.string(),
          content: z.string(),
        })
      ),
      contextType: z.literal('toolResult'),
    })
  );

const UserMessagePromptSchema = z.object({
  role: z.literal('user'),
  content: z.string(),
  contextType: z.literal('userPrompt'),
  context: ContextSchema,
});
export type UserMessagePrompt = z.infer<typeof UserMessagePromptSchema>;

const UserMessageSchema = UserMessageInternalSchema.or(UserMessagePromptSchema);
export type UserMessage = z.infer<typeof UserMessageSchema>;

const AIMessageSchema = z.object({
  role: z.literal('assistant'),
  content: z.string(),
  contextType: ContextTypeSchema,
  model: AnthropicModelSchema.or(OpenAIModelSchema),
  toolCalls: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      arguments: z.string(),
      loading: z.boolean(),
    })
  ),
});
export type AIMessage = z.infer<typeof AIMessageSchema>;

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
  );
export type OpenAIPromptMessage = z.infer<typeof OpenAIPromptMessageSchema>;

const AnthropicToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  input_schema: z
    .object({
      type: z.literal('object'),
      properties: z.record(
        z.object({
          type: z.string(),
          description: z.string(),
        })
      ),
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

export const AnthropicAutoCompleteRequestBodySchema = z.object({
  model: AnthropicModelSchema,
  messages: z.array(AnthropicPromptMessageSchema),
  temperature: z.number().min(0).max(1).default(1),
  tools: z.array(AnthropicToolSchema).optional(),
  tool_choice: AnthropicToolChoiceSchema.optional(),
});
export type AnthropicAutoCompleteRequestBody = z.infer<typeof AnthropicAutoCompleteRequestBodySchema>;

const OpenAIToolSchema = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.object({
      type: z.literal('object'),
      properties: z.record(
        z.object({
          type: z.string(),
          description: z.string(),
        })
      ),
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

export const OpenAIAutoCompleteRequestBodySchema = z.object({
  model: OpenAIModelSchema,
  messages: z.array(OpenAIPromptMessageSchema),
  temperature: z.number().min(0).max(2).default(1),
  tools: z.array(OpenAIToolSchema).optional(),
  tool_choice: OpenAIToolChoiceSchema.optional(),
});
export type OpenAIAutoCompleteRequestBody = z.infer<typeof OpenAIAutoCompleteRequestBodySchema>;
