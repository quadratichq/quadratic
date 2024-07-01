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

// Generic

// const ConnectionFieldSchema = z.object({
//   id: z.string(),
//   type: z.string(),
//   sensitive: z.enum(['AWS_SECRET', 'ENCRYPTED', 'PLAINTEXT']),
//   value: z.string(),
// })

// const ConnectionSchema = z.object({
//   id: z.string(),
//   cellLevelInput: z.string(),
//   connectionFields: z.array(ConnectionFieldSchema),
// })

// Specific

// Shared across all connections
// const ConnectionFieldNameSchema = z.object({
//   id: z.literal('name'),
//   type: z.literal('string'),
//   value: z.string().min(1).max(80), // TODO:
//   sensitivity: z.literal('PLAINTEXT'),
// });
// const ConnectionPostgresSchema = z.object({
//   id: z.literal('POSTGRES'),
//   cellLevelInput: z.literal('SINGLE_QUERY_EDITOR'),
//   fields: z.union([
//     ConnectionFieldNameSchema,
//     z.object({
//       id: z.literal('host'),
//       type: z.literal('string'),
//       value: z.string().min(1).max(80), // TODO: what is the max length of a host?
//       sensitivity: z.literal('ENCRYPTED'),
//     }),
//     z.object({
//       id: z.literal('port'),
//       type: z.literal('string'),
//       value: z.number().min(0).max(65535), // TODO: what is the max length of a port?
//       sensitivity: z.literal('ENCRYPTED'),
//     }),
//     z.object({
//       id: z.literal('database'),
//       type: z.literal('string'),
//       value: z.string().min(1).max(80), // TODO:
//       sensitivity: z.literal('ENCRYPTED'),
//     }),
//     z.object({
//       id: z.literal('username'),
//       type: z.literal('string'),
//       value: z.string().min(1).max(80), // TODO:
//       sensitivity: z.literal('ENCRYPTED'),
//     }),
//     z.object({
//       id: z.literal('password'),
//       type: z.literal('string'),
//       value: z.string().min(1).max(80), // TODO:
//       sensitivity: z.literal('AWS_SECRET'),
//     }),
//   ]),
// });
