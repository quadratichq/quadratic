import { z } from 'zod';

export const AnthropicModelSchema = z.enum(['claude-3-5-sonnet-20240620']).default('claude-3-5-sonnet-20240620');
export type AnthropicModel = z.infer<typeof AnthropicModelSchema>;

export const OpenAIModelSchema = z.enum(['gpt-4o', 'gpt-4o-2024-08-06']).default('gpt-4o');
export type OpenAIModel = z.infer<typeof OpenAIModelSchema>;

export const SystemMessageSchema = z.object({
  role: z.enum(['system']),
  content: z.string(),
});
export type SystemMessage = z.infer<typeof SystemMessageSchema>;

export const UserMessageSchema = z.object({
  role: z.enum(['user']),
  content: z.string(),
});
export type UserMessage = z.infer<typeof UserMessageSchema>;

export const AIMessageSchema = z.object({
  role: z.enum(['assistant']),
  content: z.string(),
  model: AnthropicModelSchema.or(OpenAIModelSchema),
});
export type AIMessage = z.infer<typeof AIMessageSchema>;

export const AnthropicMessageSchema = z.union([UserMessageSchema, AIMessageSchema.omit({ model: true })]);
export type AnthropicMessage = z.infer<typeof AnthropicMessageSchema>;

export const OpenAIMessageSchema = z.union([
  SystemMessageSchema,
  UserMessageSchema,
  AIMessageSchema.omit({ model: true }),
]);
export type OpenAIMessage = z.infer<typeof OpenAIMessageSchema>;

export const AnthropicAutoCompleteRequestBodySchema = z.object({
  messages: z.array(AnthropicMessageSchema),
  model: AnthropicModelSchema,
});
export type AnthropicAutoCompleteRequestBody = z.infer<typeof AnthropicAutoCompleteRequestBodySchema>;

export const OpenAIAutoCompleteRequestBodySchema = z.object({
  messages: z.array(OpenAIMessageSchema),
  model: OpenAIModelSchema,
});
export type OpenAIAutoCompleteRequestBody = z.infer<typeof OpenAIAutoCompleteRequestBodySchema>;
