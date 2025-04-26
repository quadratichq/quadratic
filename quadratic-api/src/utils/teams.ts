import type { Team } from '@prisma/client';
import dbClient from '../dbClient';
import { generateSshKeys } from './crypto';

/**
 * Applies SSH keys to a team if they don't already exist.
 * @param team - The team to apply the SSH keys to.
 */
export async function applySshKeys(team: Team) {
  if (team.sshPublicKey === null) {
    const { privateKey, publicKey } = await generateSshKeys();

    await dbClient.team.update({
      where: { id: team.id },
      data: { sshPublicKey: publicKey, sshPrivateKey: privateKey },
    });

    team.sshPublicKey = publicKey;
  }
}
