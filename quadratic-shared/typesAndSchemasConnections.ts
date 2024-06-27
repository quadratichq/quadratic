import * as z from 'zod';

// Helper to turn empty string into undefined, so JSON.stringify() will remove empty values
const transformEmptyStringToUndefined = (val: any) => (val === '' ? undefined : val);

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
    .optional()
    .refine(
      (port) => {
        if (port === '') return true;
        const portNumber = Number(port);
        if (isNaN(portNumber)) return false;
        return portNumber >= 0 && portNumber <= 65535;
      },
      {
        message: 'Port must be a valid number between 0 and 65535',
      }
    )
    .transform(transformEmptyStringToUndefined),
  database: z.string().min(1, { message: 'Required' }),
  username: z.string().optional().transform(transformEmptyStringToUndefined),
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

const GenericConnectionSchema = z.object({
  uuid: z.string().uuid(),
  createdDate: z.string().datetime(),
  updatedDate: z.string().datetime(),

  name: ConnectionNameSchema,
  type: ConnectionTypesSchema,
  typeDetails: z.any(),
});

export const ApiSchemasConnections = {
  // List connections
  '/v0/connections.GET.response': z.array(GenericConnectionSchema),
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
