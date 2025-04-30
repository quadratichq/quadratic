export const POSTGRES_DB = {
  connectionName: 'postgres-connection',
  hostname: process.env.CI ? 'postgres-connection' : 'localhost',
  port: '5432',
  database: 'postgres-connection',
  username: 'user',
  password: 'password',
};
