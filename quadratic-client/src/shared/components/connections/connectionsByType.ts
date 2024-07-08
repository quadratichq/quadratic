import { ConnectionFormProps } from '@/shared/components/connections/ConnectionForm';
import { ConnectionFormTypeMysql } from '@/shared/components/connections/ConnectionFormTypeMysql';
import { ConnectionFormTypePostgres } from '@/shared/components/connections/ConnectionFormTypePostgres';
import { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import MysqlLogo from './logo-mysql.svg?react';
import PostgresLogo from './logo-postgres.svg?react';

/**
 * This is where we define each connection used on the client and any
 * associated metadata.
 */
export const connectionsByType: Record<
  ConnectionType,
  {
    name: string;
    Logo: typeof MysqlLogo;
    Form: React.FC<ConnectionFormProps>;
  }
> = {
  POSTGRES: {
    name: 'Postgres',
    Logo: PostgresLogo,
    Form: ConnectionFormTypePostgres,
  },
  MYSQL: {
    name: 'MySQL',
    Logo: MysqlLogo,
    Form: ConnectionFormTypeMysql,
  },
};
