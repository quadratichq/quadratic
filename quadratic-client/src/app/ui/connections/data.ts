import MysqlLogo from './logo-mysql.svg?react';
import PostgresLogo from './logo-postgres.svg?react';

// import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
// type ExtractType<T> = T extends { type: infer U } ? U : never;
// type DatabaseType = ExtractType<ApiTypes['/v0/connections.GET.response'][number]>;

export const connectionsByType = {
  POSTGRES: {
    name: 'Postgres',
    Logo: PostgresLogo,
    id: 'postgres',
    // logoIconUrl: ''
    // Component: ConnectionFormFieldsPostgres,
  },
  MYSQL: {
    name: 'MySQL',
    Logo: MysqlLogo,
    id: 'mysql',
    // logoIconUrl: ''
    // Component: () => {},
  },
};
