import * as z from 'zod';

// Helper to turn empty string into undefined, so JSON.stringify() will remove empty values
const transformEmptyStringToUndefined = (val: string | undefined) => (val === '' ? undefined : val);

/**
 * =============================================================================
 * Shared schemas
 * =============================================================================
 */

export const ConnectionNameSchema = z.string().min(1, { message: 'Required' });
export const ConnectionTypeSchema = z.enum(['POSTGRES', 'MYSQL', 'MSSQL']);
const ConnectionTypeDetailsSchema = z.record(z.string(), z.any());
const ConnectionSchema = z.object({
  createdDate: z.string().datetime(),
  updatedDate: z.string().datetime(),
  name: ConnectionNameSchema,
  uuid: z.string().uuid(),

  type: ConnectionTypeSchema,
  typeDetails: ConnectionTypeDetailsSchema,
});

export type ConnectionTypeDetails = z.infer<typeof ConnectionTypeDetailsSchema>;
export type ConnectionType = z.infer<typeof ConnectionTypeSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;

/**
 * =============================================================================
 * Schemas for individual connections
 * =============================================================================
 */
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
export const ConnectionTypeDetailsMysqlSchema = ConnectionTypeDetailsPostgresSchema;
export const ConnectionTypeDetailsMssqlSchema = ConnectionTypeDetailsPostgresSchema;

/**
 * =============================================================================
 * Export
 * =============================================================================
 */

export const ApiSchemasConnections = {
  // List connections
  '/v0/teams/:uuid/connections.GET.response': z.array(
    ConnectionSchema.pick({ uuid: true, name: true, createdDate: true, type: true })
  ),

  // Create connection
  '/v0/team/:uuid/connections.POST.request': ConnectionSchema.pick({
    name: true,
    type: true,
    typeDetails: true,
  }),
  '/v0/connections.POST.response': ConnectionSchema.pick({ uuid: true }),

  // Get connection
  '/v0/connections/:uuid.GET.response': ConnectionSchema,

  // Update connection
  '/v0/connections/:uuid.PUT.request': ConnectionSchema.pick({ name: true, typeDetails: true }),
  '/v0/connections/:uuid.PUT.response': ConnectionSchema,

  // Delete connection
  '/v0/connections/:uuid.DELETE.response': z.object({ message: z.string() }),
};
