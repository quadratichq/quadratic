import { z } from 'zod';

export const AIMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
  stream: z.boolean().optional(),
});
export type AIMessage = z.infer<typeof AIMessageSchema>;

export const AIModelSchema = z.enum(['gpt-4o', 'gpt-4o-2024-08-06']).default('gpt-4o');
export type AIModel = z.infer<typeof AIModelSchema>;

export const AIAutoCompleteRequestBodySchema = z.object({
  messages: z.array(AIMessageSchema),
  model: AIModelSchema,
});
export type AIAutoCompleteRequestBody = z.infer<typeof AIAutoCompleteRequestBodySchema>;
