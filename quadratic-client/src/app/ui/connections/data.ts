import { ConnectionFormPostgres } from '@/app/ui/connections/ConnectionFormPostgres';
import MysqlLogo from './logo-mysql.svg?react';
import PostgresLogo from './logo-postgres.svg?react';

// import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
// type ExtractType<T> = T extends { type: infer U } ? U : never;
// type DatabaseType = ExtractType<ApiTypes['/v0/connections.GET.response'][number]>;

export const connectionsByType = {
  POSTGRES: {
    name: 'Postgres',
    docsLink: 'TODO: (connections)',
    Logo: PostgresLogo,
    Form: ConnectionFormPostgres,
  },
  MYSQL: {
    name: 'MySQL',
    docsLink: 'TODO: (connections)',
    Logo: MysqlLogo,
    Form: () => 'TODO: (connections) mysql form here',
  },
};
