import z from 'zod';

/**
 * =============================================================================
 * Shared
 * =============================================================================
 */
export const ConnectionNameSchema = z.string().min(1, { message: 'Required' }).max(80);
export const ConnectionTypesSchema = z.enum(['POSTGRES', 'MYSQL']);
export type ConnectionType = z.infer<typeof ConnectionTypesSchema>;

export const ConnectionTypePostgresSchema = z.literal('POSTGRES');
export const ConnectionTypeDetailsPostgresSchema = z.object({
  host: z.string().min(1, { message: 'Required' }).max(255),
  port: z.coerce.number({ invalid_type_error: 'Must be a number' }).int().positive().min(0).max(65535).optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  database: z.string().optional(),
});

const ConnectionTypeMysqlSchema = z.literal('MYSQL');
const ConnectionTypeDetailsMysqlSchema = z.object({
  // TODO: (connections) add mysql fields
  foo: z.string().min(1, { message: 'Required' }).max(255),
});

/**
 * =============================================================================
 * Schemas for client forms
 * =============================================================================
 */
export const ConnectionFormPostgresSchema = z.object({
  name: ConnectionNameSchema,
  type: ConnectionTypePostgresSchema,
  ...ConnectionTypeDetailsPostgresSchema.shape,
});
export const ConnectionFormMysqlSchema = z.object({
  name: ConnectionNameSchema,
  type: ConnectionTypeMysqlSchema,
  ...ConnectionTypeDetailsMysqlSchema.shape,
});

/**
 * =============================================================================
 * Schemas for individual connection API endpoints
 * =============================================================================
 */
const ConnectionBaseSchema = z.object({
  uuid: z.string().uuid(),
  createdDate: z.string().datetime(),
  updatedDate: z.string().datetime(),
  name: ConnectionNameSchema,
});

export const ConnectionPostgresSchema = z.object({
  ...ConnectionBaseSchema.shape,
  type: ConnectionTypePostgresSchema,
  typeDetails: ConnectionTypeDetailsPostgresSchema,
});

export const ConnectionMysqlSchema = z.object({
  ...ConnectionBaseSchema.shape,
  type: ConnectionTypeMysqlSchema,
  typeDetails: ConnectionTypeDetailsMysqlSchema,
});

/**
 * =============================================================================
 * Export
 * =============================================================================
 */

const ConnectionSchema = z.union([ConnectionPostgresSchema, ConnectionMysqlSchema]);

export const ApiSchemasConnections = {
  // List connections
  '/v0/connections.GET.response': z.array(
    z.union([ConnectionPostgresSchema.omit({ typeDetails: true }), ConnectionMysqlSchema.omit({ typeDetails: true })])
  ),

  // Create connection
  '/v0/connections.POST.request': z.union([
    z.object({
      name: ConnectionPostgresSchema.shape.name,
      type: ConnectionPostgresSchema.shape.type,
      typeDetails: ConnectionPostgresSchema.shape.typeDetails,
    }),
    z.object({
      name: ConnectionMysqlSchema.shape.name,
      type: ConnectionMysqlSchema.shape.type,
      typeDetails: ConnectionMysqlSchema.shape.typeDetails,
    }),
  ]),
  '/v0/connections.POST.response': z.object({ uuid: z.string().uuid() }),

  // Get connection
  '/v0/connections/:uuid.GET.response': ConnectionSchema,

  // Update connection
  '/v0/connections/:uuid.PUT.request': z.union([
    z.object({
      name: ConnectionPostgresSchema.shape.name,
      typeDetails: ConnectionPostgresSchema.shape.typeDetails,
    }),
    z.object({
      name: ConnectionBaseSchema.shape.name,
      typeDetails: ConnectionMysqlSchema.shape.typeDetails,
    }),
  ]),
  '/v0/connections/:uuid.PUT.response': ConnectionSchema,

  // Delete connection
  '/v0/connections/:uuid.DELETE.response': z.object({ message: z.string() }),
};
