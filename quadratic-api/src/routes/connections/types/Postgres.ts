import { Client } from 'pg';
import { connectionConfigurationZ } from '../../../../../src/api/types';

export const PostgresConnectionConfiguration = connectionConfigurationZ.parse({
  name: 'Postgres',
  type: 'POSTGRES',
  description: 'Postgres allows you to connect to a Postgres database.',
  cellLevelInput: 'SINGLE_QUERY_EDITOR',
  connectionFields: [
    {
      name: 'host',
      description: 'The host of the Postgres database.',
      type: 'string',
      sensitive: 'ENCRYPTED',
      required: true,
    },
    {
      name: 'port',
      description: 'The port of the Postgres database.',
      type: 'string',
      sensitive: 'ENCRYPTED',
      required: true,
      default: '5432',
    },
    {
      name: 'database',
      description: 'The database of the Postgres database.',
      type: 'string',
      sensitive: 'ENCRYPTED',
      required: false,
    },
    {
      name: 'username',
      description: 'The username of the Postgres database.',
      type: 'string',
      sensitive: 'ENCRYPTED',
      required: true,
    },
    {
      name: 'password',
      description: 'The password of the Postgres database.',
      type: 'string',
      sensitive: 'AWS_SECRET',
      required: false,
    },
  ],
});

export class PostgresConnection {
  validateConnectionFields(params: any) {
    // takes the connection fields and validates them without testing the connection
  }

  testConnection(params: any) {
    // takes credentials and attempts to connect to the database
    // verify that the credentials given are read only
  }

  public async runConnection(connection: any, query: string) {
    const client = new Client({
      host: connection.host,
      port: connection.port,
      database: connection.database,
      user: connection.username,
      password: connection.password,
    });
    await client.connect();

    const res = await client.query(query);
    console.log(res.rows[0].message); // Hello world!
    await client.end();

    return res.rows;
  }
}
