import z from 'zod';

/**
 * =============================================================================
 * Shared
 * =============================================================================
 */
const ConnectionNameSchema = z.string().min(1, { message: 'Required' }).max(80);

/**
 * =============================================================================
 * Schemas for client forms
 * =============================================================================
 */
export const ConnectionFormPostgresSchema = z.object({
  type: z.literal('POSTGRES'),
  name: ConnectionNameSchema,

  host: z.string().min(1, { message: 'Required' }).max(255),
  port: z.number().min(1).max(65535).optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  database: z.string().optional(),
});
export const ConnectionFormMysqlSchema = z.object({
  type: z.literal('MYSQL'),
  name: ConnectionNameSchema,

  foo: z.string().min(1, { message: 'Required' }).max(255),
});

/**
 * =============================================================================
 * Schemas for API endpoints
 * =============================================================================
 */
const ConnectionBaseSchema = z.object({
  uuid: z.string().uuid(),
  createdDate: z.string().datetime(),
  updatedDate: z.string().datetime(),
  name: ConnectionNameSchema,
});

// TODO: validate our string min/max here
const ConnectionPostgresSchema = ConnectionFormPostgresSchema.pick({ type: true, name: true }).merge(
  z.object({
    database: ConnectionFormPostgresSchema.omit({ type: true, name: true }),
  })
);

const ConnectionMysqlSchema = z.object({
  type: z.literal('MYSQL'),
  database: z.object({
    foo: z.string().min(1, { message: 'Required' }).max(255),
  }),
});

/**
 * =============================================================================
 * Export
 * =============================================================================
 */

const ConnectionSchema = z.union([
  ConnectionBaseSchema.merge(ConnectionPostgresSchema),
  ConnectionBaseSchema.merge(ConnectionMysqlSchema),
]);

export const ApiSchemasConnections = {
  // List connections
  '/v0/connections.GET.response': z.array(
    z.union([
      ConnectionBaseSchema.merge(ConnectionPostgresSchema.pick({ type: true })),
      ConnectionBaseSchema.merge(ConnectionMysqlSchema.pick({ type: true })),
    ])
  ),

  // Create connection
  '/v0/connections.POST.request': z.union([
    z.object({
      name: ConnectionBaseSchema.shape.name,
      type: ConnectionPostgresSchema.shape.type,
      database: ConnectionPostgresSchema.shape.database,
    }),
    z.object({
      name: ConnectionBaseSchema.shape.name,
      type: ConnectionMysqlSchema.shape.type,
      database: ConnectionMysqlSchema.shape.database,
    }),
  ]),
  '/v0/connections.POST.response': z.object({ uuid: z.string().uuid() }),

  // Get connection
  '/v0/connections/:uuid.GET.response': ConnectionSchema,

  // Update connection
  '/v0/connections/:uuid.PUT.request': z.union([
    z.object({
      name: ConnectionBaseSchema.shape.name,
      database: ConnectionPostgresSchema.shape.database,
    }),
    z.object({
      name: ConnectionBaseSchema.shape.name,
      database: ConnectionMysqlSchema.shape.database,
    }),
  ]),
  '/v0/connections/:uuid.PUT.response': ConnectionSchema,

  // Delete connection
  '/v0/connections/:uuid.DELETE.response': z.object({ message: z.string() }),
};
