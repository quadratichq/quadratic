import { authClient } from '@/auth/auth';
import { ConnectionType, ConnectionTypeDetails } from 'quadratic-shared/typesAndSchemasConnections';
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
type SqlSchemaResponse = z.infer<typeof SqlSchema>;

const StaticIpsSchema = z.object({
  static_ips: z.array(z.string()),
});
type StaticIpsResponse = z.infer<typeof StaticIpsSchema>;

export const connectionClient = {
  schemas: {
    get: async (
      connectionType: 'postgres' | 'mysql' | 'mssql' | 'snowflake',
      connectionId: string
    ): Promise<SqlSchemaResponse | null> => {
      const res = await fetch(`${API_URL}/${connectionType}/schema/${connectionId}`, {
        method: 'GET',
        headers: new Headers(await jwtHeader()),
      });
      if (!res.ok) {
        throw new Error('Failed to get the schema from the connection service');
      }
      const data = await res.json();
      return SqlSchema.parse(data);
    },
  },
  test: {
    run: async ({ type, typeDetails }: { type: ConnectionType; typeDetails: ConnectionTypeDetails }) => {
      try {
        const typeLower = type.toLowerCase();
        const res = await fetch(`${API_URL}/${typeLower}/test`, {
          method: 'POST',
          headers: new Headers(await jwtHeader()),
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
};
