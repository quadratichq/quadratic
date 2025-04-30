export const POSTGRES_DB = {
  connectionName: 'postgres-connection',
  hostname: process.env.CI ? 'postgres-connection' : 'localhost',
  port: process.env.CI ? '5432' : '5433',
  database: 'postgres-connection',
  username: 'user',
  password: 'password',
};
