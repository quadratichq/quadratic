import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import type { Connection } from 'quadratic-shared/typesAndSchemasConnections';
import { CONNECTION_DEMO } from '../env-vars';

export let connectionDemo: Connection | undefined;
try {
  connectionDemo = ApiSchemas['/v0/teams/:uuid/connections/:connectionUuid.GET.response'].parse({
    // Sensitive data in the env var
    ...JSON.parse(CONNECTION_DEMO),

    // Stuff we hard-code (these don't really matter for the UI)
    createdDate: '2022-01-01T00:00:00.000Z',
    updatedDate: '2022-01-01T00:00:00.000Z',
    isDemo: true,
  });
} catch (error) {
  console.log('`CONNECTION_DEMO` env var is missing or malformed. No demo connection will be available.', error);
}
