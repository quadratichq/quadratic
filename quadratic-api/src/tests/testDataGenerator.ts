import { randomUUID } from 'crypto';
import { UserTeamRole } from 'quadratic-shared/typesAndSchemas';
import dbClient from '../dbClient';

type UserData = Parameters<typeof dbClient.user.create>[0]['data'];
type FileData = Parameters<typeof dbClient.file.create>[0]['data'];
type TeamData = Parameters<typeof dbClient.team.create>[0]['data'];
type ConnectionData = Parameters<typeof dbClient.connection.create>[0]['data'];
type ConnectionType = ConnectionData['type'];

/**
 *
 * Creating a user
 *
 */
export async function createUser({ auth0Id }: Partial<UserData>) {
  const user = await dbClient.user.create({
    data: {
      auth0Id: auth0Id ?? randomUUID(),
    },
  });

  return user;
}

/**
 *
 * Creating a file
 *
 */
export async function createFile({ data }: { data: FileData }) {
  const dbFile = await dbClient.file.create({ data });
  await dbClient.fileCheckpoint.create({
    data: {
      fileId: dbFile.id,
      sequenceNumber: 0,
      s3Bucket: 'string',
      s3Key: 'string',
      version: '1.4',
    },
  });

  return dbFile;
}

/**
 *
 * Creating a team
 *
 */

export async function createTeam({
  team,
  users,
  connections,
}: {
  team?: Partial<TeamData>;
  users: Array<{ userId: number; role: UserTeamRole }>;
  connections?: Array<Partial<ConnectionData> & { type: ConnectionType }>;
}) {
  const dbTeam = await dbClient.team.create({
    data: {
      // Required fields
      name: team?.name ?? 'Test Team',
      // TODO: (connetions) this shouldn't be required
      stripeCustomerId: '1',

      // Spread in additional data
      ...(team ? team : {}),

      // Create users
      UserTeamRole: {
        create: users,
      },

      // Create connections
      Connection: {
        create: connections
          ? connections.map(({ type, ...data }) => ({
              // Required
              ...getRequiredConnectionData(type),
              // name: data?.name ?? 'Test Connection',
              // typeDetails: data?.typeDetails ?? JSON.stringify(getDefaultConnectionTypeDetails(type)),

              // Spread additional data
              ...data,
            }))
          : [],
      },
    },
  });

  return dbTeam;
}

/**
 *
 * Creating a connection
 *
 */
export async function createConnection(data: Partial<ConnectionData> & { type: ConnectionType; teamId: number }) {
  const connection = await dbClient.connection.create({
    data: {
      // Default data
      ...getRequiredConnectionData(data.type),

      // Extra we passed in
      ...data,
    },
  });

  return connection;
}

// The minimum required data for a connection
function getRequiredConnectionData(type: ConnectionType) {
  return {
    name: 'Test Connection',
    type,
    typeDetails: JSON.stringify(getDefaultConnectionTypeDetails(type)),
  };
}

// The default connection type details for a given connection type
function getDefaultConnectionTypeDetails(type: ConnectionType) {
  switch (type) {
    case 'POSTGRES':
    case 'MYSQL':
      return {
        host: 'localhost',
        port: '5432',
        database: 'postgres',
        username: 'root',
        password: 'password',
      };
    default:
      throw new Error(`No default connection data for type ${type}`);
  }
}
