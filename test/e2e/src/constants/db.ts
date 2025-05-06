export const POSTGRES_DB = {
  connectionName: 'postgres-connection',
  hostname: process.env.CI ? 'postgres-connection' : 'localhost',
  port: process.env.CI ? '5432' : '5433',
  database: 'postgres-connection',
  username: 'user',
  password: 'password',
};

export const MYSQL_DB = {
  connectionName: 'mysql-connection',
  hostname: process.env.CI ? 'mysql-connection' : 'localhost',
  port: '3306',
  database: 'mysql-connection',
  username: 'user',
  password: 'password',
};

export const MSSQL_DB = {
  connectionName: 'mssql-connection',
  hostname: process.env.CI ? 'mssql-connection' : 'localhost',
  port: '1433',
  database: 'master',
  username: 'sa',
  password: 'yourStrong(!)Password',
};
