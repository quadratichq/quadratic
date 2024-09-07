import { z } from 'zod';

export const OpenAIMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});
export type OpenAIMessage = z.infer<typeof OpenAIMessageSchema>;

export const OpenAIModelSchema = z.enum(['gpt-4o', 'gpt-4o-2024-08-06']).default('gpt-4o');
export type OpenAIModel = z.infer<typeof OpenAIModelSchema>;

export const OpenAIAutoCompleteRequestBodySchema = z.object({
  messages: z.array(OpenAIMessageSchema),
  model: OpenAIModelSchema,
});
export type OpenAIAutoCompleteRequestBody = z.infer<typeof OpenAIAutoCompleteRequestBodySchema>;

export const AIMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});
export type AIMessage = z.infer<typeof AIMessageSchema>;

export const AnthropicModelSchema = z.enum(['claude-3-5-sonnet-20240620']).default('claude-3-5-sonnet-20240620');
export type AnthropicModel = z.infer<typeof AnthropicModelSchema>;

export const AnthropicAutoCompleteRequestBodySchema = z.object({
  messages: z.array(AIMessageSchema),
  model: AnthropicModelSchema,
});
export type AnthropicAutoCompleteRequestBody = z.infer<typeof AnthropicAutoCompleteRequestBodySchema>;
