import { z } from 'zod';

export const AnthropicModelSchema = z.enum(['claude-3-5-sonnet-20240620']).default('claude-3-5-sonnet-20240620');
export type AnthropicModel = z.infer<typeof AnthropicModelSchema>;

export const OpenAIModelSchema = z.enum(['gpt-4o', 'o1-preview']).default('gpt-4o');
export type OpenAIModel = z.infer<typeof OpenAIModelSchema>;

export const ContextTypeSchema = z.enum([
  'quadraticDocs',
  'connections',
  'allSheets',
  'currentSheet',
  'visibleData',
  'selection',
  'codeCell',
  'userPrompt',
]);
export type ContextType = z.infer<typeof ContextTypeSchema>;

export const PromptMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});
export type PromptMessage = z.infer<typeof PromptMessageSchema>;

export const UserMessageSchema = PromptMessageSchema.extend({
  role: z.literal('user'),
  internalContext: z.boolean(),
  contextType: ContextTypeSchema,
});
export type UserMessage = z.infer<typeof UserMessageSchema>;

export const AIMessageSchema = PromptMessageSchema.extend({
  role: z.literal('assistant'),
  model: AnthropicModelSchema.or(OpenAIModelSchema),
  internalContext: z.boolean(),
  contextType: ContextTypeSchema,
  functionCalls: z
    .array(
      z.object({
        name: z.string(),
        arguments: z.string(),
      })
    )
    .optional(),
});
export type AIMessage = z.infer<typeof AIMessageSchema>;

export const AnthropicToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  input_schema: z
    .object({
      type: z.literal('object'),
      properties: z.record(z.unknown()).optional().nullable(),
      required: z.array(z.string()).optional(),
    })
    .and(z.record(z.unknown())),
});
export type AnthropicTool = z.infer<typeof AnthropicToolSchema>;

export const AnthropicToolChoiceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('auto') }),
  z.object({ type: z.literal('any') }),
  z.object({ type: z.literal('tool'), name: z.string() }),
]);
export type AnthropicToolChoice = z.infer<typeof AnthropicToolChoiceSchema>;

export const AnthropicAutoCompleteRequestBodySchema = z.object({
  model: AnthropicModelSchema,
  messages: z.array(PromptMessageSchema),
  temperature: z.number().min(0).max(1).default(1),
  tools: z.array(AnthropicToolSchema).optional(),
  tool_choice: AnthropicToolChoiceSchema.optional(),
});
export type AnthropicAutoCompleteRequestBody = z.infer<typeof AnthropicAutoCompleteRequestBodySchema>;

export const OpenAIToolSchema = z.object({
  type: z.enum(['function']),
  function: z.object({
    name: z.string(),
    description: z.string().optional(),
    parameters: z.object({
      type: z.literal('object'),
      properties: z.record(
        z.object({
          type: z.string(),
          description: z.string().optional(),
        })
      ),
      required: z.array(z.string()).optional(),
    }),
    strict: z.boolean().optional(),
  }),
});
export type OpenAITool = z.infer<typeof OpenAIToolSchema>;

export const OpenAIToolChoiceSchema = z.union([
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
  messages: z.array(PromptMessageSchema),
  temperature: z.number().min(0).max(2).default(1),
  tools: z.array(OpenAIToolSchema).optional(),
  tool_choice: OpenAIToolChoiceSchema.optional(),
});
export type OpenAIAutoCompleteRequestBody = z.infer<typeof OpenAIAutoCompleteRequestBodySchema>;
