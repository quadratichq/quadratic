import * as Bigquery from '@/shared/components/connections/ConnectionFormBigquery';
import * as Cockroachdb from '@/shared/components/connections/ConnectionFormCockroachdb';
import * as Mariadb from '@/shared/components/connections/ConnectionFormMariadb';
import * as Mssql from '@/shared/components/connections/ConnectionFormMssql';
import * as Mysql from '@/shared/components/connections/ConnectionFormMysql';
import * as Neon from '@/shared/components/connections/ConnectionFormNeon';
import * as Postgres from '@/shared/components/connections/ConnectionFormPostgres';
import * as Snowflake from '@/shared/components/connections/ConnectionFormSnowflake';
import * as Supabase from '@/shared/components/connections/ConnectionFormSupabase';
import type { Connection, ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import type { ReactNode } from 'react';
import type { SubmitHandler, UseFormReturn } from 'react-hook-form';
import BigqueryLogo from './logo-bigquery.svg?react';
import CockroachdbLogo from './logo-cockroachdb.svg?react';
import MariadbLogo from './logo-mariadb.svg?react';
import MssqlLogo from './logo-mssql.svg?react';
import MysqlLogo from './logo-mysql.svg?react';
import NeonLogo from './logo-neon.svg?react';
import PostgresLogo from './logo-postgres.svg?react';
import SnowflakeLogo from './logo-snowflake.svg?react';
import SupabaseLogo from './logo-supabase.svg?react';

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
  handleSubmitForm: SubmitHandler<ConnectionFormValues>;
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
  BIGQUERY: {
    name: 'BigQuery',
    Logo: BigqueryLogo,
    ConnectionForm: Bigquery.ConnectionForm,
    useConnectionForm: Bigquery.useConnectionForm,
  },
  COCKROACHDB: {
    name: 'CockroachDB',
    Logo: CockroachdbLogo,
    ConnectionForm: Cockroachdb.ConnectionForm,
    useConnectionForm: Cockroachdb.useConnectionForm,
  },
  MARIADB: {
    name: 'MariaDB',
    Logo: MariadbLogo,
    ConnectionForm: Mariadb.ConnectionForm,
    useConnectionForm: Mariadb.useConnectionForm,
  },
  SUPABASE: {
    name: 'Supabase',
    Logo: SupabaseLogo,
    ConnectionForm: Supabase.ConnectionForm,
    useConnectionForm: Supabase.useConnectionForm,
  },
  NEON: {
    name: 'Neon',
    Logo: NeonLogo,
    ConnectionForm: Neon.ConnectionForm,
    useConnectionForm: Neon.useConnectionForm,
  },
};
