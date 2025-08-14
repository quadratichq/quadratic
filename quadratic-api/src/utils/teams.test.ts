import type { Team, User } from '@prisma/client';
import dbClient from '../dbClient';
import { clearDb } from '../tests/testDataGenerator';
import { createTeam, decryptSshKeys, getDecryptedTeam } from './teams';

const TEAM_ID = '00000000-0000-9000-8000-000000000001';
export const TEAM_OWNER_AUTH0_ID = 'teamOwner';

/**
 * TEAM TEST UTLITIES
 */
export async function getTeam(teamId: string): Promise<Team | null> {
  return await dbClient.team.findUnique({
    where: { uuid: teamId },
  });
}

export async function createTeamOwner(): Promise<User> {
  return await dbClient.user.create({
    data: {
      auth0Id: TEAM_OWNER_AUTH0_ID,
      email: `${TEAM_OWNER_AUTH0_ID}@test.com`,
    },
  });
}

export async function createTeamWithOwner(name: string, teamId: string): Promise<User> {
  const teamOwner = await createTeamOwner();
  await dbClient.team.create({
    data: {
      name,
      uuid: teamId,
      UserTeamRole: {
        create: [
          {
            userId: teamOwner.id,
            role: 'OWNER',
          },
        ],
      },
    },
  });
  return teamOwner;
}

let teamOwner: User | null = null;

beforeEach(async () => {
  teamOwner = await createTeamWithOwner('Test Team 1', TEAM_ID);
});
afterEach(clearDb);

describe('createTeam', () => {
  it('should create a team', async () => {
    if (!teamOwner) throw new Error('teamOwner is null');
    const select = {
      uuid: true,
      name: true,
    };
    const team = await createTeam('Test Team 2', teamOwner.id, select);
    expect(team).toBeDefined();
  });
});

describe('applySshKeys', () => {
  it('should apply SSH keys to a team', async () => {
    const team = await getTeam(TEAM_ID);

    if (!team) {
      throw new Error(`Team not found in applySshKeys: ${TEAM_ID}`);
    }

    expect(team?.sshPublicKey).toBeNull();
    expect(team?.sshPrivateKey).toBeNull();

    await getDecryptedTeam(team);

    const updatedTeam = await getTeam(TEAM_ID);

    expect(updatedTeam?.sshPublicKey).not.toBeNull();
    expect(updatedTeam?.sshPrivateKey).not.toBeNull();
  });

  it('should not apply SSH keys to a team if they already exist', async () => {
    const team = await getTeam(TEAM_ID);

    if (!team) {
      throw new Error(`Team not found in applySshKeys: ${TEAM_ID}`);
    }

    expect(team?.sshPublicKey).toBeNull();
    expect(team?.sshPrivateKey).toBeNull();

    await getDecryptedTeam(team);

    const updatedTeam = await getTeam(TEAM_ID);
    const sshPublicKey = updatedTeam?.sshPublicKey;
    const sshPrivateKey = updatedTeam?.sshPrivateKey;

    await getDecryptedTeam(updatedTeam as Team);

    const updatedTeam2 = await getTeam(TEAM_ID);
    const sshPublicKey2 = updatedTeam2?.sshPublicKey;
    const sshPrivateKey2 = updatedTeam2?.sshPrivateKey;

    expect(sshPublicKey).toStrictEqual(sshPublicKey2);
    expect(sshPrivateKey).toStrictEqual(sshPrivateKey2);
  });
});

describe('decryptSshKeys', () => {
  it('should decrypt the SSH keys of a team', async () => {
    const team = await getTeam(TEAM_ID);

    if (!team) {
      throw new Error(`Team not found in decryptSshKeys: ${TEAM_ID}`);
    }

    await getDecryptedTeam(team);

    const updatedTeam = await getTeam(TEAM_ID);

    if (!updatedTeam) {
      throw new Error(`Team not found in decryptSshKeys: ${TEAM_ID}`);
    }

    // these keys should be encrypted
    const sshPublicKey = updatedTeam.sshPublicKey;
    const sshPrivateKey = updatedTeam.sshPrivateKey;

    // decrypt the keys
    const decryptedTeam = decryptSshKeys(updatedTeam);

    // the encrypted keys should not match the decrypted keys
    expect(decryptedTeam.sshPublicKey).not.toBe(sshPublicKey);
    expect(decryptedTeam.sshPrivateKey).not.toBe(sshPrivateKey);
  });
});
