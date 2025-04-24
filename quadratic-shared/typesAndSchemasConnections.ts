import * as z from 'zod';

// Helper to turn empty string into undefined, so JSON.stringify() will remove empty values
const transformEmptyStringToUndefined = (val: string | undefined) => (val === '' ? undefined : val);

/**
 * =============================================================================
 * Shared schemas
 * =============================================================================
 */

export const ConnectionNameSchema = z.string().min(1, { message: 'Required' });
export const ConnectionTypeSchema = z.enum(['POSTGRES', 'MYSQL', 'MSSQL', 'SNOWFLAKE']);

// Helper function to check if a host address is a localhost variant
export function isLocalHostAddress(host: string): boolean {
  host = host.trim();

  // Check for localhost variations
  if (host.includes('localhost')) return true;

  // Check for local IP ranges
  if (host.startsWith('127.')) return true; // Loopback addresses
  if (host.includes('0.0.0.0')) return true; // Default route
  if (host.startsWith('169.254.')) return true; // Link-local addresses

  return false;
}

const ConnectionHostSchema = z
  .string()
  .min(1, { message: 'Required' })
  .superRefine((val, ctx) => {
    if (isLocalHostAddress(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please note: Quadratic runs in the cloud. Connecting to a local database has limited support.',
        path: [],
        fatal: false, // This makes it a warning rather than an error
      });
    }
  });
const ConnectionPortSchema = z
  .string()
  .min(1, { message: 'Required' })
  .refine(
    (port) => {
      const portNumber = Number(port);
      if (isNaN(portNumber)) return false;
      return portNumber >= 0 && portNumber <= 65535;
    },
    { message: 'Port must be a valid number between 0 and 65535' }
  );
const ConnectionTypeDetailsSchema = z.record(z.string(), z.any());
const ConnectionSchema = z.object({
  createdDate: z.string().datetime(),
  updatedDate: z.string().datetime(),
  name: ConnectionNameSchema,
  uuid: z.string().uuid(),

  type: ConnectionTypeSchema,
  typeDetails: ConnectionTypeDetailsSchema,
});
const ConnectionSshSchema = z.object({
  useSsh: z.boolean(),
  sshHost: z.string().optional(),
  sshPort: z.string().optional(),
  sshUsername: z.string().optional(),
});

export type ConnectionTypeDetails = z.infer<typeof ConnectionTypeDetailsSchema>;
export type ConnectionType = z.infer<typeof ConnectionTypeSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;
export type ConnectionSsh = z.infer<typeof ConnectionSshSchema>;

/**
 * =============================================================================
 * Schemas for individual connections
 * =============================================================================
 */
export const ConnectionTypeDetailsBaseSchema = z.object({
  host: ConnectionHostSchema,
  port: ConnectionPortSchema,
  database: z.string().min(1, { message: 'Required' }),
  username: z.string().min(1, { message: 'Required' }),
  password: z.string().optional().transform(transformEmptyStringToUndefined),
  ...ConnectionSshSchema.shape,
});
export const ConnectionTypeDetailsPostgresSchema = ConnectionTypeDetailsBaseSchema;
export const ConnectionTypeDetailsMysqlSchema = ConnectionTypeDetailsBaseSchema;
export const ConnectionTypeDetailsMssqlSchema = ConnectionTypeDetailsBaseSchema.extend({
  database: z.string().optional(),
  password: z.string().min(1, { message: 'Required' }),
});

export const ConnectionTypeDetailsSnowflakeSchema = z.object({
  account_identifier: z.string().min(1, { message: 'Required' }),
  database: z.string().min(1, { message: 'Required' }),
  username: z.string().min(1, { message: 'Required' }),
  password: z.string().min(1, { message: 'Required' }),
  warehouse: z.string().optional().transform(transformEmptyStringToUndefined),
  role: z.string().optional().transform(transformEmptyStringToUndefined),
});

/**
 * =============================================================================
 * Export
 * =============================================================================
 */

export const ConnectionListSchema = z.array(
  ConnectionSchema.pick({ uuid: true, name: true, createdDate: true, type: true })
);
export type ConnectionList = z.infer<typeof ConnectionListSchema>;

export const ApiSchemasConnections = {
  // List connections
  '/v0/teams/:uuid/connections.GET.response': ConnectionListSchema,

  // Create connection
  '/v0/teams/:uuid/connections.POST.request': ConnectionSchema.pick({
    name: true,
    type: true,
    typeDetails: true,
  }),
  '/v0/teams/:uuid/connections.POST.response': ConnectionSchema.pick({ uuid: true }),

  // Get connection
  '/v0/teams/:uuid/connections/:connectionUuid.GET.response': ConnectionSchema,

  // Update connection
  '/v0/teams/:uuid/connections/:connectionUuid.PUT.request': ConnectionSchema.pick({ name: true, typeDetails: true }),
  '/v0/teams/:uuid/connections/:connectionUuid.PUT.response': ConnectionSchema,

  // Delete connection
  '/v0/teams/:uuid/connections/:connectionUuid.DELETE.response': z.object({ message: z.string() }),
};
