import { authClient } from '@/auth';
import {
  ConnectionTypeDetailsMysqlSchema,
  ConnectionTypeDetailsPostgresSchema,
} from 'quadratic-shared/typesAndSchemasConnections';
import z from 'zod';
const API_URL = import.meta.env.VITE_QUADRATIC_CONNECTION_URL;

// Postgres
//
// TODO: (connections) these should come from the connection service definition for these endpoints
// but for now, they are defined here
export type TestConnectionResponse = {
  connected: boolean;
  message: string | null;
};

export const connectionClient = {
  test: {
    mysql: async (body: z.infer<typeof ConnectionTypeDetailsMysqlSchema>) => {
      try {
        let jwt = await authClient.getTokenOrRedirect();
        const res = fetch(`${API_URL}/mysql/test`, {
          method: 'POST',
          headers: new Headers({ 'content-type': 'application/json', authorization: `Bearer ${jwt}` }),
          body: JSON.stringify(body),
        });
        const json: TestConnectionResponse = await res.then((res) => res.json());
        return json;
      } catch (err) {
        console.error('Failed to connect to connection service', err);
        return {
          connected: false,
          message:
            'Network error: failed to make connection. Make sure you’re connected to the internet and try again.',
        };
      }
    },
    postgres: async (body: z.infer<typeof ConnectionTypeDetailsPostgresSchema>) => {
      try {
        let jwt = await authClient.getTokenOrRedirect();
        const res = fetch(`${API_URL}/postgres/test`, {
          method: 'POST',
          headers: new Headers({ 'content-type': 'application/json', authorization: `Bearer ${jwt}` }),
          body: JSON.stringify(body),
        });
        const json: TestConnectionResponse = await res.then((res) => res.json());
        return json;
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
};
