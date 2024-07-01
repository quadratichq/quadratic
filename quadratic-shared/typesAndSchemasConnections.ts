import * as z from 'zod';

// Helper to turn empty string into undefined, so JSON.stringify() will remove empty values
const transformEmptyStringToUndefined = (val: string | undefined) => (val === '' ? undefined : val);

/**
 * =============================================================================
 * Shared
 * =============================================================================
 */

export const ConnectionNameSchema = z.string().min(1, { message: 'Required' }).max(80);
export const ConnectionTypesSchema = z.enum(['POSTGRES', 'MYSQL']);
export type ConnectionType = z.infer<typeof ConnectionTypesSchema>;

export const ConnectionTypePostgresSchema = z.literal(ConnectionTypesSchema.enum.POSTGRES);
export const ConnectionTypeDetailsPostgresSchema = z.object({
  host: z.string().min(1, { message: 'Required' }),
  port: z
    .string()
    .min(1, { message: 'Required' })
    .refine(
      (port) => {
        const portNumber = Number(port);
        if (isNaN(portNumber)) return false;
        return portNumber >= 0 && portNumber <= 65535;
      },
      {
        message: 'Port must be a valid number between 0 and 65535',
      }
    ),
  database: z.string().min(1, { message: 'Required' }),
  username: z.string().min(1, { message: 'Required' }),
  password: z.string().optional().transform(transformEmptyStringToUndefined),
});

export const ConnectionTypeMysqlSchema = z.literal(ConnectionTypesSchema.enum.MYSQL);
export const ConnectionTypeDetailsMysqlSchema = ConnectionTypeDetailsPostgresSchema;

/**
 * =============================================================================
 * Forms
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
  ...ConnectionTypeDetailsPostgresSchema.shape,
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
export type ConnectionPostgres = z.infer<typeof ConnectionPostgresSchema>;

export const ConnectionMysqlSchema = z.object({
  ...ConnectionBaseSchema.shape,
  type: ConnectionTypeMysqlSchema,
  typeDetails: ConnectionTypeDetailsMysqlSchema,
});
export type ConnectionMysql = z.infer<typeof ConnectionMysqlSchema>;

const ConnectionSchema = z.union([ConnectionPostgresSchema, ConnectionMysqlSchema]);
export type Connection = z.infer<typeof ConnectionSchema>;

/**
 * =============================================================================
 * Export
 * =============================================================================
 */

const GenericConnectionSchema = z.object({
  uuid: z.string().uuid(),
  createdDate: z.string().datetime(),
  updatedDate: z.string().datetime(),
  name: ConnectionNameSchema,

  type: ConnectionTypesSchema,
  typeDetails: z.union([ConnectionTypeDetailsPostgresSchema, ConnectionTypeDetailsMysqlSchema]),
});

export const ApiSchemasConnections = {
  // List connections
  '/v0/connections?team-uuid.GET.response': z.array(GenericConnectionSchema),
  '/v0/connections?file-uuid.GET.response': z.array(GenericConnectionSchema.omit({ typeDetails: true })),
  // z.array(
  //   z.union([ConnectionPostgresSchema.omit({ typeDetails: true }), ConnectionMysqlSchema.omit({ typeDetails: true })])
  // ),

  // Create connection
  '/v0/connections.POST.request': GenericConnectionSchema.pick({
    name: true,
    type: true,
    typeDetails: true,
  }),
  // z.union([
  //   z.object({
  //     name: ConnectionPostgresSchema.shape.name,
  //     type: ConnectionPostgresSchema.shape.type,
  //     typeDetails: ConnectionPostgresSchema.shape.typeDetails,
  //   }),
  //   z.object({
  //     name: ConnectionMysqlSchema.shape.name,
  //     type: ConnectionMysqlSchema.shape.type,
  //     typeDetails: ConnectionMysqlSchema.shape.typeDetails,
  //   }),
  // ]),
  '/v0/connections.POST.response': z.object({ uuid: z.string().uuid() }),

  // Get connection
  '/v0/connections/:uuid.GET.response': GenericConnectionSchema,

  // Update connection
  '/v0/connections/:uuid.PUT.request': GenericConnectionSchema.pick({ name: true, typeDetails: true }),
  // z.union([
  //   z.object({
  //     name: ConnectionPostgresSchema.shape.name,
  //     typeDetails: ConnectionPostgresSchema.shape.typeDetails,
  //   }),
  //   z.object({
  //     name: ConnectionBaseSchema.shape.name,
  //     typeDetails: ConnectionMysqlSchema.shape.typeDetails,
  //   }),
  // ]),
  '/v0/connections/:uuid.PUT.response': GenericConnectionSchema,

  // Delete connection
  '/v0/connections/:uuid.DELETE.response': z.object({ message: z.string() }),
};
