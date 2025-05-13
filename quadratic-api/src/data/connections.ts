import type { Connection } from 'quadratic-shared/typesAndSchemasConnections';
import { CONNECTION_DEMO } from '../env-vars';

export const connectionDemo = {
  // uuid, name, type, typeDetails all go in the env var
  ...CONNECTION_DEMO,

  // We set these because they don't really matter for the UI
  createdDate: '2022-01-01T00:00:00.000Z',
  updatedDate: '2022-01-01T00:00:00.000Z',
} as Connection;

export const connectionDemoCondensed = {
  uuid: connectionDemo.uuid,
  name: connectionDemo.name,
  type: connectionDemo.type,
  createdDate: connectionDemo.createdDate,
} as const;
