import type { Prisma, Team } from '@prisma/client';
import { TeamClientDataKvSchema } from 'quadratic-shared/typesAndSchemas';
import dbClient from '../dbClient';
import { isRunningInTest } from '../env-vars';
import { getIsMonthlySubscription } from '../stripe/stripe';
import { ApiError } from './ApiError';
import { decryptFromEnv, encryptFromEnv, generateSshKeys } from './crypto';

export type DecryptedTeam = Omit<Team, 'sshPublicKey' | 'sshPrivateKey'> & {
  sshPublicKey: string;
  sshPrivateKey: string;
};

// keys singleton
let keys: Promise<{ sshPublicKey: Uint8Array; sshPrivateKey: Uint8Array }> | null = null;
export async function getKeys(): Promise<{ sshPublicKey: Uint8Array; sshPrivateKey: Uint8Array }> {
  if (keys === null || !isRunningInTest) {
    keys = generateSshKeys().then(({ privateKey, publicKey }) => {
      const publicKeyBuffer = Buffer.from(encryptFromEnv(publicKey));
      const privateKeyBuffer = Buffer.from(encryptFromEnv(privateKey));
      // Create new ArrayBuffer and copy data to ensure Uint8Array<ArrayBuffer> type
      const sshPublicKey = new Uint8Array(new ArrayBuffer(publicKeyBuffer.length));
      sshPublicKey.set(publicKeyBuffer);
      const sshPrivateKey = new Uint8Array(new ArrayBuffer(privateKeyBuffer.length));
      sshPrivateKey.set(privateKeyBuffer);
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

  const sshPublicKey = decryptFromEnv(Buffer.from(team.sshPublicKey).toString('utf-8'));
  const sshPrivateKey = decryptFromEnv(Buffer.from(team.sshPrivateKey).toString('utf-8'));

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

/**
 * Determines if a team is eligible for a retention discount, and returns the
 * subscription ID if they are
 */
export async function getTeamRetentionDiscountEligibility(
  team: Team
): Promise<{ isEligible: true; stripeSubscriptionId: string } | { isEligible: false }> {
  // Don't have an active subscription? No discount for you
  if (!team.stripeSubscriptionId || team.stripeSubscriptionStatus !== 'ACTIVE') {
    return { isEligible: false };
  }

  // Already used it? No discount for you
  if (team.stripeSubscriptionRetentionCouponId) {
    return { isEligible: false };
  }

  // Not a monthly subscription? No discount for you
  const isMonthly = await getIsMonthlySubscription(team.stripeSubscriptionId);
  if (!isMonthly) {
    return { isEligible: false };
  }

  return { isEligible: true, stripeSubscriptionId: team.stripeSubscriptionId };
}
