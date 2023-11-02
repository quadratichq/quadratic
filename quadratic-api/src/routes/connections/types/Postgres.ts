import { ConnectionConfiguration } from './Base';

export const PostgresConnectionConfiguration = {
  name: 'Postgres',
  type: 'POSTGRES',
  description: 'Postgres allows you to connect to a Postgres database.',
  connectionFields: [
    {
      name: 'host',
      description: 'The host of the Postgres database.',
      type: 'string',
      sensitive: false,
      required: true,
    },
    {
      name: 'port',
      description: 'The port of the Postgres database.',
      type: 'string',
      sensitive: false,
      required: true,
    },
    {
      name: 'database',
      description: 'The database of the Postgres database.',
      type: 'string',
      sensitive: false,
      required: true,
    },
    {
      name: 'username',
      description: 'The username of the Postgres database.',
      type: 'string',
      sensitive: false,
      required: true,
    },
    {
      name: 'password',
      description: 'The password of the Postgres database.',
      type: 'string',
      sensitive: true,
      required: true,
    },
  ],
} as ConnectionConfiguration;

export class PostgresConnection {
  validateConnectionFields(params: any) {
    // takes the connection fields and validates them without testing the connection
  }

  testConnection(params: any) {
    // takes credentials and attempts to connect to the database
    // verify that the credentials given are read only
  }

  getData() {
    // takes the connection and a cell and returns the data in the Quadratic Format
  }
}
