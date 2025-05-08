import type { Connection } from 'quadratic-shared/typesAndSchemasConnections';
import { CONNECTION_DEMO } from '../env-vars';

export const demoConnection = {
  // uuid, name, type, typeDetails all go in the env var
  ...CONNECTION_DEMO,

  // We set these because they don't really matter for the UI
  createdDate: '2022-01-01T00:00:00.000Z',
  updatedDate: '2022-01-01T00:00:00.000Z',
  isDemo: true,
} as Connection;

export const demoConnectionCondensend = {
  uuid: demoConnection.uuid,
  name: demoConnection.name,
  type: demoConnection.type,
  createdDate: demoConnection.createdDate,
  isDemo: demoConnection.isDemo,
} as const;
