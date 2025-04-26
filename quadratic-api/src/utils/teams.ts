import type { Prisma, Team } from '@prisma/client';
import dbClient from '../dbClient';
import { decryptFromEnv, encryptFromEnv, generateSshKeys } from './crypto';

export async function createTeam<T extends Prisma.TeamSelect>(
  name: string,
  ownerUserId: number,
  select: T
): Promise<unknown> {
  const { privateKey, publicKey } = await generateSshKeys();

  return await dbClient.team.create({
    data: {
      name,
      sshPublicKey: encryptFromEnv(publicKey),
      sshPrivateKey: encryptFromEnv(privateKey),
      UserTeamRole: {
        create: {
          userId: ownerUserId,
          role: 'OWNER',
        },
      },
    },
    select,
  });
}

/**
 * Applies SSH keys to a team if they don't already exist.
 * @param team - The team to apply the SSH keys to.
 */
export async function applySshKeys(team: Team) {
  if (team.sshPublicKey === null) {
    const { privateKey, publicKey } = await generateSshKeys();

    await dbClient.team.update({
      where: { id: team.id },
      data: {
        sshPublicKey: encryptFromEnv(publicKey),
        sshPrivateKey: encryptFromEnv(privateKey),
      },
    });

    // only set the public key to keep the private key from being exposed
    team.sshPublicKey = publicKey;
  }
}

/**
 * Decrypts the SSH keys of a team.
 * @param team - The team to decrypt the SSH keys of.
 * @returns The team with the decrypted SSH keys.
 */
export function decryptSshKeys(team: Team): Team {
  if (team.sshPublicKey === null || team.sshPrivateKey === null) {
    throw new Error('SSH keys are not set');
  }

  team.sshPublicKey = decryptFromEnv(team.sshPublicKey);
  team.sshPrivateKey = decryptFromEnv(team.sshPrivateKey);

  return team;
}
