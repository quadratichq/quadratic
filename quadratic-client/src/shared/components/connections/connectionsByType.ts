import * as Mssql from '@/shared/components/connections/ConnectionFormMssql';
import * as Mysql from '@/shared/components/connections/ConnectionFormMysql';
import * as Postgres from '@/shared/components/connections/ConnectionFormPostgres';
import * as Snowflake from '@/shared/components/connections/ConnectionFormSnowflake';
import { Connection, ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { ReactNode } from 'react';
import { UseFormReturn } from 'react-hook-form';
import MssqlLogo from './logo-mssql.svg?react';
import MysqlLogo from './logo-mysql.svg?react';
import PostgresLogo from './logo-postgres.svg?react';
import SnowflakeLogo from './logo-snowflake.svg?react';

export type ConnectionFormValues = {
  name: string;
  type: ConnectionType;
  // This represents the `typeDetails` and varies from one form to the next
  // depending on the connection type.
  [key: string]: any;
};

export type UseConnectionForm<T extends ConnectionFormValues> = (connection: Connection | undefined) => {
  form: UseFormReturn<T>;
};

export type ConnectionFormComponent<T extends ConnectionFormValues> = (props: {
  form: UseFormReturn<T>;
  children: ReactNode;
  handleSubmitForm: (formValues: ConnectionFormValues) => void;
}) => ReactNode;

type ConnectionTypeData<T extends ConnectionFormValues> = {
  name: string;
  Logo: typeof MysqlLogo;

  ConnectionForm: ConnectionFormComponent<T>;
  useConnectionForm: UseConnectionForm<T>;
};

/**
 * This is where we define each connection used on the client and any
 * associated metadata.
 */
export const connectionsByType: Record<ConnectionType, ConnectionTypeData<any>> = {
  POSTGRES: {
    name: 'Postgres',
    Logo: PostgresLogo,
    ConnectionForm: Postgres.ConnectionForm,
    useConnectionForm: Postgres.useConnectionForm,
  },
  MYSQL: {
    name: 'MySQL',
    Logo: MysqlLogo,
    ConnectionForm: Mysql.ConnectionForm,
    useConnectionForm: Mysql.useConnectionForm,
  },
  MSSQL: {
    name: 'MS SQL Server',
    Logo: MssqlLogo,
    ConnectionForm: Mssql.ConnectionForm,
    useConnectionForm: Mssql.useConnectionForm,
  },
  SNOWFLAKE: {
    name: 'Snowflake',
    Logo: SnowflakeLogo,
    ConnectionForm: Snowflake.ConnectionForm,
    useConnectionForm: Snowflake.useConnectionForm,
  },
};
