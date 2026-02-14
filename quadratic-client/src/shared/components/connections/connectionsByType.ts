import * as Bigquery from '@/shared/components/connections/ConnectionFormBigquery';
import * as Cockroachdb from '@/shared/components/connections/ConnectionFormCockroachdb';
import * as GoogleAnalytics from '@/shared/components/connections/ConnectionFormGoogleAnalytics';
import * as Mariadb from '@/shared/components/connections/ConnectionFormMariadb';
import * as Mixpanel from '@/shared/components/connections/ConnectionFormMixpanel';
import * as Mssql from '@/shared/components/connections/ConnectionFormMssql';
import * as Mysql from '@/shared/components/connections/ConnectionFormMysql';
import * as Neon from '@/shared/components/connections/ConnectionFormNeon';
import * as Plaid from '@/shared/components/connections/ConnectionFormPlaid';
import * as Postgres from '@/shared/components/connections/ConnectionFormPostgres';
import * as Snowflake from '@/shared/components/connections/ConnectionFormSnowflake';
import * as Supabase from '@/shared/components/connections/ConnectionFormSupabase';
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
import FinancialMarketDataLogo from './logo-financial-market-data.svg?react';
import GoogleAnalyticsLogo from './logo-google-analytics.svg?react';
import HubspotLogo from './logo-hubspot.svg?react';
import MariadbLogo from './logo-mariadb.svg?react';
import MixpanelLogo from './logo-mixpanel.svg?react';
import MongoLogo from './logo-mongodb.svg?react';
import MssqlLogo from './logo-mssql.svg?react';
import MysqlLogo from './logo-mysql.svg?react';
import NeonLogo from './logo-neon.svg?react';
import NetsuiteLogo from './logo-netsuite.svg?react';
import OracleLogo from './logo-oracle.svg?react';
import OtherLogo from './logo-other.svg?react';
import PlaidLogo from './logo-plaid.svg?react';
import PostgresLogo from './logo-postgres.svg?react';
import QuickbooksLogo from './logo-quickbooks.svg?react';
import RedshiftLogo from './logo-redshift.svg?react';
import S3Logo from './logo-s3.svg?react';
import SalesforceLogo from './logo-salesforce.svg?react';
import SapLogo from './logo-sap.svg?react';
import ShopifyLogo from './logo-shopify.svg?react';
import SlackLogo from './logo-slack.svg?react';
import SnowflakeLogo from './logo-snowflake.svg?react';
import StripeLogo from './logo-stripe.svg?react';
import SupabaseLogo from './logo-supabase.svg?react';

export type ConnectionFormValues = {
  name: string;
  semanticDescription?: string;
  type: ConnectionType;
  // This represents the `typeDetails` and varies from one form to the next
  // depending on the connection type.
  [key: string]: any;
};

export type UseConnectionForm<T extends ConnectionFormValues> = (connection: Connection | undefined) => {
  form: UseFormReturn<T>;
  percentCompleted?: number;
};

export type ConnectionFormComponent<T extends ConnectionFormValues> = (props: {
  form: UseFormReturn<T>;
  children: ReactNode;
  handleSubmitForm: SubmitHandler<ConnectionFormValues>;
  handleCancelForm: () => void;
  percentCompleted?: number;
  connection?: Connection;
  teamUuid: string;
}) => ReactNode;

type ConnectionTypeData<T extends ConnectionFormValues> = {
  name: string;
  Logo: typeof MysqlLogo;
  uiCategory?: 'Databases' | 'Analytics';

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
    uiCategory: 'Databases',
    ConnectionForm: Postgres.ConnectionForm,
    useConnectionForm: Postgres.useConnectionForm,
  },
  MYSQL: {
    name: 'MySQL',
    Logo: MysqlLogo,
    uiCategory: 'Databases',
    ConnectionForm: Mysql.ConnectionForm,
    useConnectionForm: Mysql.useConnectionForm,
  },
  MSSQL: {
    name: 'MS SQL Server',
    Logo: MssqlLogo,
    uiCategory: 'Databases',
    ConnectionForm: Mssql.ConnectionForm,
    useConnectionForm: Mssql.useConnectionForm,
  },
  SNOWFLAKE: {
    name: 'Snowflake',
    Logo: SnowflakeLogo,
    uiCategory: 'Databases',
    ConnectionForm: Snowflake.ConnectionForm,
    useConnectionForm: Snowflake.useConnectionForm,
  },
  BIGQUERY: {
    name: 'BigQuery',
    Logo: BigqueryLogo,
    uiCategory: 'Databases',
    ConnectionForm: Bigquery.ConnectionForm,
    useConnectionForm: Bigquery.useConnectionForm,
  },
  COCKROACHDB: {
    name: 'CockroachDB',
    Logo: CockroachdbLogo,
    uiCategory: 'Databases',
    ConnectionForm: Cockroachdb.ConnectionForm,
    useConnectionForm: Cockroachdb.useConnectionForm,
  },
  MARIADB: {
    name: 'MariaDB',
    Logo: MariadbLogo,
    uiCategory: 'Databases',
    ConnectionForm: Mariadb.ConnectionForm,
    useConnectionForm: Mariadb.useConnectionForm,
  },
  SUPABASE: {
    name: 'Supabase',
    Logo: SupabaseLogo,
    uiCategory: 'Databases',
    ConnectionForm: Supabase.ConnectionForm,
    useConnectionForm: Supabase.useConnectionForm,
  },
  NEON: {
    name: 'Neon',
    Logo: NeonLogo,
    uiCategory: 'Databases',
    ConnectionForm: Neon.ConnectionForm,
    useConnectionForm: Neon.useConnectionForm,
  },
  MIXPANEL: {
    name: 'Mixpanel',
    Logo: MixpanelLogo,
    uiCategory: 'Analytics',
    ConnectionForm: Mixpanel.ConnectionForm,
    useConnectionForm: Mixpanel.useConnectionForm,
  },
  GOOGLE_ANALYTICS: {
    name: 'Google Analytics',
    Logo: GoogleAnalyticsLogo,
    uiCategory: 'Analytics',
    ConnectionForm: GoogleAnalytics.ConnectionForm,
    useConnectionForm: GoogleAnalytics.useConnectionForm,
  },
  PLAID: {
    name: 'Plaid',
    Logo: PlaidLogo,
    ConnectionForm: Plaid.ConnectionForm,
    useConnectionForm: Plaid.useConnectionForm,
  },
  DATAFUSION: {
    name: 'DataFusion',
    Logo: FinancialMarketDataLogo,
    // DataFusion connections are platform-managed and not user-editable
    ConnectionForm: (() => null) as any,
    useConnectionForm: (() => ({ form: {} })) as any,
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
  | 'SALESFORCE'
  | 'HUBSPOT'
  | 'SLACK'
  | 'STRIPE'
  | 'SAP'
  | 'NETSUITE'
  | 'QUICKBOOKS'
  | 'SHOPIFY'
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
  SALESFORCE: {
    name: 'Salesforce',
    Logo: SalesforceLogo,
  },
  HUBSPOT: {
    name: 'HubSpot',
    Logo: HubspotLogo,
  },
  SLACK: {
    name: 'Slack',
    Logo: SlackLogo,
  },
  STRIPE: {
    name: 'Stripe',
    Logo: StripeLogo,
  },
  SAP: {
    name: 'SAP',
    Logo: SapLogo,
  },
  NETSUITE: {
    name: 'NetSuite',
    Logo: NetsuiteLogo,
  },
  QUICKBOOKS: {
    name: 'QuickBooks',
    Logo: QuickbooksLogo,
  },
  SHOPIFY: {
    name: 'Shopify',
    Logo: ShopifyLogo,
  },
  OTHER: {
    name: 'Other',
    Logo: OtherLogo,
  },
};
