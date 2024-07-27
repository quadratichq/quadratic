import type { Connection, ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import type { ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import * as Mysql from '@/shared/components/connections/ConnectionFormMysql';
import * as Postgres from '@/shared/components/connections/ConnectionFormPostgres';
import MysqlLogo from '@/shared/components/connections/logo-mysql.svg?react';
import PostgresLogo from '@/shared/components/connections/logo-postgres.svg?react';

export type ConnectionFormValues = {
  name: string;
  type: ConnectionType;
  // This represents the `typeDetails` and varies from one form to the next
  // depeinding on the connection type.
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
};
