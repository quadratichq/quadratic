import { z } from 'zod';

export const AnthropicModelSchema = z.enum(['claude-3-5-sonnet-20240620']).default('claude-3-5-sonnet-20240620');
export type AnthropicModel = z.infer<typeof AnthropicModelSchema>;

export const OpenAIModelSchema = z.enum(['gpt-4o', 'gpt-4o-2024-08-06', 'o1-preview']).default('gpt-4o');
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

export const UserMessageSchema = z.object({
  role: z.literal('user'),
  content: z.string(),
  internalContext: z.boolean(),
  contextType: ContextTypeSchema,
});
export type UserMessage = z.infer<typeof UserMessageSchema>;

export const AIMessageSchema = z.object({
  role: z.literal('assistant'),
  content: z.string(),
  model: AnthropicModelSchema.or(OpenAIModelSchema),
  internalContext: z.boolean(),
  contextType: ContextTypeSchema,
});
export type AIMessage = z.infer<typeof AIMessageSchema>;

export const PromptMessageSchema = z.union([
  UserMessageSchema.pick({ role: true, content: true }),
  AIMessageSchema.pick({ role: true, content: true }),
]);
export type PromptMessage = z.infer<typeof PromptMessageSchema>;

export const AnthropicAutoCompleteRequestBodySchema = z.object({
  model: AnthropicModelSchema,
  messages: z.array(PromptMessageSchema),
  temperature: z.number().min(0).max(1).default(1),
});
export type AnthropicAutoCompleteRequestBody = z.infer<typeof AnthropicAutoCompleteRequestBodySchema>;

export const OpenAIAutoCompleteRequestBodySchema = z.object({
  model: OpenAIModelSchema,
  messages: z.array(PromptMessageSchema),
  temperature: z.number().min(0).max(2).default(1),
});
export type OpenAIAutoCompleteRequestBody = z.infer<typeof OpenAIAutoCompleteRequestBodySchema>;
