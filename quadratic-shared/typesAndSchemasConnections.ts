import { z } from 'zod';

// Helper to turn empty string into undefined, so JSON.stringify() will remove empty values
const transformEmptyStringToUndefined = (val: any): string | undefined =>
  typeof val === 'string' && !!val ? val : undefined;

/**
 * =============================================================================
 * Shared schemas
 * =============================================================================
 */

export const ConnectionNameSchema = z.string().min(1, { message: 'Required' });
export const ConnectionTypeSchema = z.enum([
  'POSTGRES',
  'MYSQL',
  'MSSQL',
  'SNOWFLAKE',
  'BIGQUERY',
  'COCKROACHDB',
  'MARIADB',
  'SUPABASE',
  'NEON',
  'MIXPANEL',
  'GOOGLE_ANALYTICS',
  'PLAID',
]);
export const ConnectionSemanticDescriptionSchema = z.string().optional().transform(transformEmptyStringToUndefined);

export function isSyncedConnectionType(type: ConnectionType): boolean {
  return ['MIXPANEL', 'GOOGLE_ANALYTICS', 'PLAID'].includes(type);
}

// Helper function to check if a host address is a localhost variant
export function isLocalHostAddress(host: string): boolean {
  host = host.trim();

  // Check for localhost variations
  if (host.includes('localhost')) return true;

  // Check for local IP ranges
  if (host === 'unknown') return true;

  if (host === '::1') return true;
  if (host.startsWith('127.')) return true; // Loopback addresses
  if (host.includes('0.0.0.0')) return true; // Default route
  if (host.startsWith('169.254.')) return true; // Link-local addresses

  return false;
}

const ConnectionHostSchema = z.string().min(1, { message: 'Required' });
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
export const ConnectionTypeDetailsSchema = z.record(z.string(), z.any());
export const SyncedConnectionLatestLogStatusSchema = z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED']);
export type SyncedConnectionLatestLogStatus = z.infer<typeof SyncedConnectionLatestLogStatusSchema>;

const ConnectionSchema = z.object({
  createdDate: z.string().datetime(),
  updatedDate: z.string().datetime(),
  name: ConnectionNameSchema,
  uuid: z.string().uuid(),
  isDemo: z.boolean().optional(),
  semanticDescription: ConnectionSemanticDescriptionSchema,
  type: ConnectionTypeSchema,
  typeDetails: ConnectionTypeDetailsSchema,
  syncedConnectionPercentCompleted: z.number().optional(),
  syncedConnectionUpdatedDate: z.string().datetime().optional(),
  syncedConnectionLatestLogStatus: SyncedConnectionLatestLogStatusSchema.optional(),
  syncedConnectionLatestLogError: z.string().optional(),
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
});
export const ConnectionTypeDetailsBaseSchemaWithSsh = z.object({
  ...ConnectionTypeDetailsBaseSchema.shape,
  ...ConnectionSshSchema.shape,
});
export const ConnectionTypeDetailsPostgresSchema = ConnectionTypeDetailsBaseSchemaWithSsh;
export const ConnectionTypeDetailsCockroachdbSchema = ConnectionTypeDetailsBaseSchemaWithSsh;
export const ConnectionTypeDetailsSupabaseSchema = ConnectionTypeDetailsBaseSchema;
export const ConnectionTypeDetailsNeonSchema = ConnectionTypeDetailsBaseSchema;

export const ConnectionTypeDetailsMysqlSchema = ConnectionTypeDetailsBaseSchemaWithSsh;
export const ConnectionTypeDetailsMariadbSchema = ConnectionTypeDetailsBaseSchemaWithSsh;

export const ConnectionTypeDetailsMssqlSchema = ConnectionTypeDetailsBaseSchemaWithSsh.extend({
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

export const ConnectionTypeDetailsBigquerySchema = z.object({
  project_id: z.string().min(1, { message: 'Required' }),
  dataset: z.string().min(1, { message: 'Required' }),
  service_account_configuration: z.string().min(1, { message: 'Required' }),
});

export const ConnectionTypeDetailsMixpanelSchema = z.object({
  api_secret: z.string().min(1, { message: 'Required' }),
  project_id: z.string().min(1, { message: 'Required' }),
  start_date: z.string().date(),
});

// Google Analytics connection - supports both Service Account (legacy) and OAuth authentication
// Service Account: Uses service_account_configuration JSON
// OAuth: Uses access_token, refresh_token, and token_expires_at
const GoogleAnalyticsBaseSchema = z.object({
  property_id: z.string().min(1, { message: 'Required' }),
  start_date: z.string().date(),
});

export const ConnectionTypeDetailsGoogleAnalyticsSchema = z.union([
  // Service Account authentication (legacy)
  GoogleAnalyticsBaseSchema.extend({
    service_account_configuration: z.string().min(1),
    access_token: z.undefined().optional(),
    refresh_token: z.undefined().optional(),
    token_expires_at: z.undefined().optional(),
  }),
  // OAuth authentication (preferred)
  GoogleAnalyticsBaseSchema.extend({
    service_account_configuration: z.undefined().optional(),
    access_token: z.string().min(1),
    refresh_token: z.string().min(1),
    token_expires_at: z.string().datetime(),
  }),
]);

export const ConnectionTypeDetailsPlaidSchema = z.object({
  access_token: z.string().min(1, { message: 'Required' }),
  start_date: z.string().date(),
  institution_name: z.string().optional(), // For display purposes
});

/**
 * =============================================================================
 * Schemas for synced connections
 * =============================================================================
 */
export const SyncedConnectionSchema = z.object({
  id: z.number(),
  connectionId: z.number(),
  percentCompleted: z.number(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DELETED']),
  updatedDate: z.string().datetime(),
});
export type SyncedConnection = z.infer<typeof SyncedConnectionSchema>;

export const SyncedConnectionLogSchema = z.object({
  id: z.number(),
  syncedConnectionId: z.number(),
  runId: z.string(),
  syncedDates: z.array(z.string()),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED']),
  error: z.string().optional(),
  createdDate: z.string().datetime(),
});
export type SyncedConnectionLog = z.infer<typeof SyncedConnectionLogSchema>;

/**
 * =============================================================================
 * Export
 * =============================================================================
 */

export const ConnectionListSchema = z.array(
  ConnectionSchema.pick({
    uuid: true,
    name: true,
    createdDate: true,
    type: true,
    semanticDescription: true,
    isDemo: true,
    syncedConnectionPercentCompleted: true,
    syncedConnectionUpdatedDate: true,
    syncedConnectionLatestLogStatus: true,
    syncedConnectionLatestLogError: true,
  })
);
export type ConnectionList = z.infer<typeof ConnectionListSchema>;

export const ConnectionListSchemaInternal = z.array(
  z.object({
    uuid: z.string().uuid(),
    name: ConnectionNameSchema,
    type: ConnectionTypeSchema,
    teamId: z.string().uuid(),
    semanticDescription: ConnectionSemanticDescriptionSchema,
    typeDetails: ConnectionTypeDetailsSchema,
  })
);

export const ApiSchemasConnections = {
  // List connections
  '/v0/teams/:uuid/connections.GET.response': ConnectionListSchema,

  // Create connection
  '/v0/teams/:uuid/connections.POST.request': ConnectionSchema.pick({
    name: true,
    semanticDescription: true,
    type: true,
    typeDetails: true,
  }),
  '/v0/teams/:uuid/connections.POST.response': ConnectionSchema.pick({ uuid: true }),

  // Get connection
  '/v0/teams/:uuid/connections/:connectionUuid.GET.response': ConnectionSchema,

  // Update connection
  '/v0/teams/:uuid/connections/:connectionUuid.PUT.request': ConnectionSchema.pick({
    name: true,
    semanticDescription: true,
    typeDetails: true,
  }),
  '/v0/teams/:uuid/connections/:connectionUuid.PUT.response': ConnectionSchema,

  // Delete connection
  '/v0/teams/:uuid/connections/:connectionUuid.DELETE.response': z.object({ message: z.string() }),

  // Get all connections (internal)
  '/v0/internal/connection.GET.response': ConnectionListSchemaInternal,

  // Get synced connection
  '/v0/synced-connection/:syncedConnectionId.GET.response': SyncedConnectionSchema,

  // Get all synced connections (internal)
  '/v0/internal/synced-connection.GET.response': SyncedConnectionSchema,

  // Get synced connection logs
  '/v0/teams/:uuid/connections/:connectionUuid/log.GET.response': z.array(SyncedConnectionLogSchema),

  // Plaid integration endpoints
  '/v0/teams/:uuid/plaid/link-token.POST.request': z.object({}),
  '/v0/teams/:uuid/plaid/link-token.POST.response': z.object({
    linkToken: z.string(),
  }),

  '/v0/teams/:uuid/plaid/exchange-token.POST.request': z.object({
    publicToken: z.string(),
  }),
  '/v0/teams/:uuid/plaid/exchange-token.POST.response': z.object({
    accessToken: z.string(),
    itemId: z.string(),
  }),

  // Google OAuth endpoints (for Google Analytics)
  '/v0/teams/:uuid/google/auth-url.GET.response': z.object({
    authUrl: z.string(),
    nonce: z.string(),
  }),

  '/v0/teams/:uuid/google/exchange-token.POST.request': z.object({
    code: z.string(),
    state: z.string().min(1),
  }),
  '/v0/teams/:uuid/google/exchange-token.POST.response': z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresAt: z.string().datetime(),
  }),
};
