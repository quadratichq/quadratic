import * as Bigquery from '@/shared/components/connections/ConnectionFormBigquery';
import * as Cockroachdb from '@/shared/components/connections/ConnectionFormCockroachdb';
import * as Mariadb from '@/shared/components/connections/ConnectionFormMariadb';
import * as Mssql from '@/shared/components/connections/ConnectionFormMssql';
import * as Mysql from '@/shared/components/connections/ConnectionFormMysql';
import * as Neon from '@/shared/components/connections/ConnectionFormNeon';
import * as Postgres from '@/shared/components/connections/ConnectionFormPostgres';
import * as Snowflake from '@/shared/components/connections/ConnectionFormSnowflake';
import * as Supabase from '@/shared/components/connections/ConnectionFormSupabase';
import * as Synced from '@/shared/components/connections/ConnectionFormSynced';
import type { Connection, ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import type { ReactNode } from 'react';
import type { SubmitHandler, UseFormReturn } from 'react-hook-form';
import AthenaLogo from './logo-athena.svg?react';
import BigqueryLogo from './logo-bigquery.svg?react';
import CassandraLogo from './logo-cassandra.svg?react';
import ClickhouseLogo from './logo-clickhouse.svg?react';
import CockroachdbLogo from './logo-cockroachdb.svg?react';
import DatabricksLogo from './logo-databricks.svg?react';
import DynamoDBLogo from './logo-dynamodb.svg?react';
import MariadbLogo from './logo-mariadb.svg?react';
import MongoLogo from './logo-mongodb.svg?react';
import MssqlLogo from './logo-mssql.svg?react';
import MysqlLogo from './logo-mysql.svg?react';
import NeonLogo from './logo-neon.svg?react';
import OracleLogo from './logo-oracle.svg?react';
import OtherLogo from './logo-other.svg?react';
import PostgresLogo from './logo-postgres.svg?react';
import RedshiftLogo from './logo-redshift.svg?react';
import S3Logo from './logo-s3.svg?react';
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
  SYNCED: {
    name: 'Synced',
    Logo: S3Logo,
    ConnectionForm: Synced.ConnectionForm,
    useConnectionForm: Synced.useConnectionForm,
  },
};

export type PotentialConnectionType =
  | 'DATABRICKS'
  | 'REDSHIFT'
  | 'ATHENA'
  | 'S3'
  | 'DYNAMODB'
  | 'CASSANDRA'
  | 'CLICKHOUSE'
  | 'MONGODB'
  | 'ORACLE'
  | 'OTHER';
export const potentialConnectionsByType: Record<
  PotentialConnectionType,
  {
    name: string;
    Logo: typeof ClickhouseLogo;
  }
> = {
  DATABRICKS: {
    name: 'Databricks',
    Logo: DatabricksLogo,
  },
  REDSHIFT: {
    name: 'Redshift',
    Logo: RedshiftLogo,
  },
  ATHENA: {
    name: 'Athena',
    Logo: AthenaLogo,
  },
  S3: {
    name: 'S3',
    Logo: S3Logo,
  },
  DYNAMODB: {
    name: 'DynamoDB',
    Logo: DynamoDBLogo,
  },
  CASSANDRA: {
    name: 'Cassandra',
    Logo: CassandraLogo,
  },
  CLICKHOUSE: {
    name: 'ClickHouse',
    Logo: ClickhouseLogo,
  },
  MONGODB: {
    name: 'MongoDB',
    Logo: MongoLogo,
  },
  ORACLE: {
    name: 'Oracle',
    Logo: OracleLogo,
  },
  OTHER: {
    name: 'Other',
    Logo: OtherLogo,
  },
};
