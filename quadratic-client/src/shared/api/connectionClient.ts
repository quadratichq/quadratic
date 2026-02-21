import { authClient } from '@/auth/auth';
import type { ConnectionType, ConnectionTypeDetails } from 'quadratic-shared/typesAndSchemasConnections';
import z from 'zod';
const API_URL = import.meta.env.VITE_QUADRATIC_CONNECTION_URL;

const jwtHeader = async (): Promise<HeadersInit> => {
  let jwt = await authClient.getTokenOrRedirect();
  return { 'content-type': 'application/json', authorization: `Bearer ${jwt}` };
};

// TODO: these should come from the connection service definition for these
// endpoints but for now, they are defined here
const TestSchema = z.object({ connected: z.boolean(), message: z.string().nullable() });

const SqlSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  database: z.string(),
  tables: z.array(
    z.object({
      name: z.string(),
      schema: z.string(), // public or ...?
      columns: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          is_nullable: z.boolean(),
        })
      ),
    })
  ),
});
export type SqlSchemaResponse = z.infer<typeof SqlSchema>;

const StaticIpsSchema = z.object({
  static_ips: z.array(z.string()),
});
type StaticIpsResponse = z.infer<typeof StaticIpsSchema>;

const StockPricesRequestSchema = z.object({
  identifier: z.string(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  frequency: z.string().nullable().optional(),
});

export type StockPricesRequest = z.infer<typeof StockPricesRequestSchema>;

export const connectionClient = {
  schemas: {
    // ignore case of connection type
    get: async (
      connectionType:
        | 'postgres'
        | 'POSTGRES'
        | 'mysql'
        | 'MYSQL'
        | 'mssql'
        | 'MSSQL'
        | 'snowflake'
        | 'SNOWFLAKE'
        | 'cockroachdb'
        | 'COCKROACHDB'
        | 'BIGQUERY'
        | 'mariadb'
        | 'MARIADB'
        | 'supabase'
        | 'SUPABASE'
        | 'neon'
        | 'NEON'
        | 'mixpanel'
        | 'MIXPANEL'
        | 'google_analytics'
        | 'GOOGLE_ANALYTICS'
        | 'plaid'
        | 'PLAID',
      connectionId: string,
      teamUuid: string,
      forceCacheRefresh: boolean = false,
      timeout: number = 60000
    ): Promise<SqlSchemaResponse | null> => {
      // This might get called on a public file (where the user might not be
      // logged in but can still access the file). If they're not logged in,
      // we won't make the request (to prevent the redirect). It'll fail silently
      const loggedIn = await authClient.isAuthenticated();
      if (!loggedIn) {
        console.log("User is not logged in, so we won't make a request to the connection service.");
        return null;
      }

      const headers = new Headers(await jwtHeader());
      headers.set('X-Team-Id', teamUuid);

      const url = `${API_URL}/${connectionType.toLowerCase().replace(/_/g, '-')}/schema/${connectionId}?force_cache_refresh=${forceCacheRefresh}`;
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(timeout),
      });
      if (!res.ok) {
        throw new Error('Failed to get the schema from the connection service');
      }
      const data = await res.json();
      return SqlSchema.parse(data);
    },
  },
  test: {
    run: async ({
      type,
      typeDetails,
      teamUuid,
    }: {
      type: ConnectionType;
      typeDetails: ConnectionTypeDetails;
      teamUuid: string;
    }) => {
      try {
        const typeLower = type.toLowerCase().replace(/_/g, '-');
        const headers = new Headers(await jwtHeader());
        headers.set('X-Team-Id', teamUuid);

        const res = await fetch(`${API_URL}/${typeLower}/test`, {
          method: 'POST',
          headers,
          body: JSON.stringify(typeDetails),
        });
        const data = await res.json();
        return TestSchema.parse(data);
      } catch (err) {
        console.error('Failed to connect to connection service', err);
        return {
          connected: false,
          message:
            'Network error: failed to make connection. Make sure you’re connected to the internet and try again.',
        };
      }
    },
  },
  staticIps: {
    list: async (): Promise<string[] | null> => {
      try {
        const res = await fetch(`${API_URL}/static-ips`, {
          method: 'GET',
          headers: new Headers(await jwtHeader()),
        });
        const data = await res.json();
        const { static_ips } = StaticIpsSchema.parse(data) as StaticIpsResponse;
        return static_ips;
      } catch (err) {
        console.error('Failed to get the static ips from the connection service', err);
        return null;
      }
    },
  },
  financial: {
    stockPrices: async (
      teamUuid: string,
      request: StockPricesRequest
    ): Promise<{ data: unknown; error: string | null }> => {
      try {
        const headers = new Headers(await jwtHeader());
        headers.set('X-Team-Id', teamUuid);

        const res = await fetch(`${API_URL}/financial/stock-prices`, {
          method: 'POST',
          headers,
          body: JSON.stringify(request),
        });

        if (!res.ok) {
          const errorText = await res.text();
          return {
            data: null,
            error: `Stock prices request failed with status ${res.status}: ${errorText}`,
          };
        }

        const data = await res.json();
        return { data, error: null };
      } catch (err) {
        console.error('Failed to fetch stock prices from connection service', err);
        return {
          data: null,
          error: err instanceof Error ? err.message : 'Unknown error fetching stock prices',
        };
      }
    },
  },
};
