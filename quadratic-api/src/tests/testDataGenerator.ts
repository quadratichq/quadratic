import type { File, User } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { UserTeamRole } from 'quadratic-shared/typesAndSchemas';
import { toUint8Array } from 'quadratic-shared/utils/Uint8Array';
import dbClient from '../dbClient';
import { encryptFromEnv } from '../utils/crypto';
import { createScheduledTask } from '../utils/scheduledTasks';
import { getDecryptedTeam, type DecryptedTeam } from '../utils/teams';

type UserData = Parameters<typeof dbClient.user.create>[0]['data'];
type FileData = Parameters<typeof dbClient.file.create>[0]['data'];
type TeamData = Parameters<typeof dbClient.team.create>[0]['data'];
type ConnectionData = Parameters<typeof dbClient.connection.create>[0]['data'];
type ConnectionType = ConnectionData['type'];
type AnalyticsAIChatData = Parameters<typeof dbClient.analyticsAIChat.create>[0]['data'];

/**
 *
 * Creating a user
 *
 */
export async function createUser({ auth0Id }: Partial<UserData>) {
  const id = auth0Id ?? randomUUID();
  const email = `${id}@test.com`.toLowerCase();
  const user = await dbClient.user.create({
    data: {
      auth0Id: id,
      email,
      clientDataKv: {
        lastSeenChangelogVersion: process.env.VERSION || undefined,
      },
    },
  });

  return user;
}
export async function createUsers(auth0Ids: string[]) {
  const users = await Promise.all(auth0Ids.map((auth0Id) => createUser({ auth0Id })));
  return users;
}

/**
 *
 * Creating a file
 * TODO: require the ownerTeamId
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

  return getDecryptedTeam(dbTeam);
}

export const createUserTeamAndFile = async (): Promise<{
  uniqueId: string;
  testUser: User;
  testTeam: DecryptedTeam;
  testFile: File;
}> => {
  // Generate unique IDs to avoid database conflicts
  const uniqueId = Math.random().toString(36).substring(2, 15);

  const testUser = await createUser({ auth0Id: `test-user-${uniqueId}` });
  const testTeam = await createTeam({
    users: [{ userId: testUser.id, role: 'OWNER' }],
  });
  const testFile = await createFile({
    data: {
      name: `Test File ${uniqueId}`,
      ownerTeamId: testTeam.id,
      creatorUserId: testUser.id,
    },
  });

  return { uniqueId, testUser, testTeam, testFile };
};

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
    typeDetails: Buffer.from(encryptFromEnv(JSON.stringify(getDefaultConnectionTypeDetails(type)))),
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
        password: '',
      };
    case 'MSSQL':
      return {
        host: 'localhost',
        port: '1433',
        database: 'msdb',
        username: 'sa',
        password: 'yourStrong(!)Password',
      };
    case 'SNOWFLAKE':
      return {
        account: 'xxxx-us-east-1',
        port: '433',
        warehouse: 'compute',
        database: 'msdb',
        user: 'snowman',
        role: 'ACCOUNTADMIN',
        password: 'password',
      };
    default:
      throw new Error(`No default connection data for type ${type}`);
  }
}

/**
 *
 * Creating an Analytics AI chat
 *
 */
export async function createAIChat(
  data: Partial<AnalyticsAIChatData> & {
    userId?: number;
    teamId?: number;
    fileId?: number;
    messages?: Array<{
      messageIndex: number;
      model: string;
      messageType: 'userPrompt' | 'toolResult';
    }>;
  }
) {
  const userId = data.userId ?? (await createUser({ auth0Id: 'user' })).id;
  const fileId =
    data.fileId ??
    (
      await createFile({
        data: {
          name: 'Untitled',
          ownerTeamId: data.teamId ?? (await createTeam({ users: [{ userId, role: 'OWNER' }] })).id,
          creatorUserId: userId,
        },
      })
    ).id;
  const messages = data.messages ?? [
    {
      messageIndex: 1,
      model: 'bedrock-anthropic:us.anthropic.claude-sonnet-4-20250514-v1:0:thinking-toggle-on',
      messageType: 'userPrompt' as const,
    },
  ];
  const aiChat = await dbClient.analyticsAIChat.create({
    data: {
      userId,
      fileId,
      chatId: data.chatId ?? randomUUID(),
      source: 'AIAnalyst',
      messages: {
        create: messages,
      },
    },
  });
  return aiChat;
}

/**
 *
 * Upgrades stripe status on team to ACTIVE (team is pro)
 *
 */
export async function upgradeTeamToPro(teamId?: number) {
  await dbClient.team.update({
    where: { id: teamId },
    data: {
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: 'ACTIVE',
      stripeCurrentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      stripeSubscriptionLastUpdated: null,
    },
  });
}

export const scheduledTask = async (userId: number, fileId: number) =>
  await createScheduledTask({
    userId,
    fileId,
    cronExpression: '0 0 * * *',
    operations: Array.from(toUint8Array({ action: 'test', type: 'daily' })),
  });

/**
 *
 * Single function for clearing the database. Not every test will use all these
 * tables, but it's easier to clear everything in one reusable function and
 * ensure things are deleted in the proper order.
 *
 */
export async function clearDb() {
  await dbClient.$transaction([
    dbClient.analyticsAIChatMessage.deleteMany(),
    dbClient.analyticsAIChat.deleteMany(),
    dbClient.aICost.deleteMany(),
    dbClient.userBudgetLimit.deleteMany(),
    dbClient.scheduledTaskLog.deleteMany(),
    dbClient.scheduledTask.deleteMany(),
    dbClient.fileCheckpoint.deleteMany(),
    dbClient.fileInvite.deleteMany(),
    dbClient.userFileRole.deleteMany(),
    dbClient.file.deleteMany(),
    dbClient.syncedConnectionLog.deleteMany(),
    dbClient.syncedConnection.deleteMany(),
    dbClient.connection.deleteMany(),
    dbClient.userTeamRole.deleteMany(),
    dbClient.teamInvite.deleteMany(),
    dbClient.team.deleteMany(),
    dbClient.user.deleteMany(),
  ]);
}
