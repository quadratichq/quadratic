import type { Prisma, Team } from '@prisma/client';
import { TeamClientDataKvSchema } from 'quadratic-shared/typesAndSchemas';
import dbClient from '../dbClient';
import { isRunningInTest } from '../env-vars';
import { ApiError } from './ApiError';
import { decryptFromEnv, encryptFromEnv, generateSshKeys } from './crypto';

export type DecryptedTeam = Omit<Team, 'sshPublicKey' | 'sshPrivateKey'> & {
  sshPublicKey: string;
  sshPrivateKey: string;
};

// keys singleton
let keys: Promise<{ sshPublicKey: Buffer; sshPrivateKey: Buffer }> | null = null;
export async function getKeys(): Promise<{ sshPublicKey: Buffer; sshPrivateKey: Buffer }> {
  if (keys === null || !isRunningInTest) {
    keys = generateSshKeys().then(({ privateKey, publicKey }) => {
      const sshPublicKey = Buffer.from(encryptFromEnv(publicKey));
      const sshPrivateKey = Buffer.from(encryptFromEnv(privateKey));
      return { sshPublicKey, sshPrivateKey };
    });
  }
  return keys;
}

export async function createTeam<T extends Prisma.TeamSelect>(
  name: string,
  ownerUserId: number,
  select: T
): Promise<Team> {
  const { sshPublicKey, sshPrivateKey } = await getKeys();

  const result = await dbClient.team.create({
    data: {
      name,
      sshPublicKey,
      sshPrivateKey,
      UserTeamRole: {
        create: {
          userId: ownerUserId,
          role: 'OWNER',
        },
      },
    },
    select,
  });
  return result as Team;
}

/**
 * Gets a decrypted team.
 * Applies SSH keys to a team if they don't already exist.
 * @param team - The team to apply the SSH keys to.
 * @returns The decrypted team.
 */
export async function getDecryptedTeam(team: Team): Promise<DecryptedTeam> {
  let encryptedTeam = { ...team };

  if (encryptedTeam.sshPublicKey === null || encryptedTeam.sshPrivateKey === null) {
    const { sshPublicKey, sshPrivateKey } = await getKeys();

    encryptedTeam = await dbClient.team.update({
      where: { id: encryptedTeam.id },
      data: {
        sshPublicKey,
        sshPrivateKey,
      },
    });
  }

  return decryptSshKeys(encryptedTeam);
}

/**
 * Decrypts the SSH keys of a team.
 * @param team - The team to decrypt the SSH keys of.
 * @returns The team with the decrypted SSH keys.
 */
export function decryptSshKeys(team: Team): DecryptedTeam {
  if (team.sshPublicKey === null || team.sshPrivateKey === null) {
    throw new Error('SSH keys are not set');
  }

  const sshPublicKey = decryptFromEnv(team.sshPublicKey.toString('utf-8'));
  const sshPrivateKey = decryptFromEnv(team.sshPrivateKey.toString('utf-8'));

  return { ...team, sshPublicKey, sshPrivateKey };
}

/**
 * Ensures that the data going in & coming out of this column is always a
 * JSON object
 */
export function parseAndValidateClientDataKv(clientDataKv: unknown) {
  const parseResult = TeamClientDataKvSchema.safeParse(clientDataKv);
  if (!parseResult.success) {
    throw new ApiError(500, '`clientDataKv` must be a valid JSON object');
  }
  return parseResult.data;
}
