import { Connection, ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { ConnectionFormTypeMysql } from './ConnectionFormTypeMysql';
import { ConnectionFormTypePostgres } from './ConnectionFormTypePostgres';

export function ConnectionFormCreate({
  type,
  handleNavigateToListView,
}: {
  type: ConnectionType;
  handleNavigateToListView: () => void;
}) {
  let props = {
    handleNavigateToListView,
  };
  switch (type) {
    case 'POSTGRES':
      return <ConnectionFormTypePostgres {...props} />;
    case 'MYSQL':
      return <ConnectionFormTypeMysql {...props} />;
    default:
      // This should never happen. Log to sentry?
      throw new Error('Unknown form type');
  }
}

export function ConnectionFormEdit({
  connection,
  handleNavigateToListView,
}: {
  connection: Connection;
  handleNavigateToListView: () => void;
}) {
  switch (connection.type) {
    case 'POSTGRES':
      return <ConnectionFormTypePostgres connection={connection} handleNavigateToListView={handleNavigateToListView} />;
    case 'MYSQL':
      return <ConnectionFormTypeMysql connection={connection} handleNavigateToListView={handleNavigateToListView} />;
    default:
      // This should never happen. Log to sentry?
      throw new Error('Unknown form type');
  }
}
