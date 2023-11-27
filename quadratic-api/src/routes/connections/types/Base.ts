import { z } from 'zod';

export const connectionFieldZ = z.object({
  name: z.string(),
  description: z.string(),
  type: z.string(),
  sensitive: z.enum(['AWS_SECRET', 'ENCRYPTED', 'PLAINTEXT']),
  required: z.boolean(),
  default: z.string().optional(),
});

export const connectionConfigurationZ = z.object({
  name: z.string(),
  type: z.enum(['POSTGRES']),
  description: z.string(),
  connectionFields: z.array(connectionFieldZ),
  cellLevelInput: z.enum(['SINGLE_QUERY_EDITOR']),
});

export type ConnectionConfiguration = z.infer<typeof connectionConfigurationZ>;
export type ConnectionField = z.infer<typeof connectionFieldZ>;
