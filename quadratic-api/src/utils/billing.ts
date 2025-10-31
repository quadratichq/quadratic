import type { Team } from '@prisma/client';
import { SubscriptionStatus } from '@prisma/client';
import dbClient from '../dbClient';
import { isRunningInTest, MAX_FILE_COUNT_FOR_PAID_PLAN } from '../env-vars';
import { updateBilling } from '../stripe/stripe';
import type { DecryptedTeam } from '../utils/teams';
import logger from './logger';

export const getIsOnPaidPlan = async (team: Team | DecryptedTeam) => {
  if (isRunningInTest) {
    return team.stripeSubscriptionStatus === SubscriptionStatus.ACTIVE;
  }

  if (team.stripeSubscriptionStatus === SubscriptionStatus.ACTIVE && !!team.stripeCurrentPeriodEnd) {
    // If the team is on a paid plan, but the current period has ended, update the billing info
    if (team.stripeCurrentPeriodEnd < new Date()) {
      await updateBilling(team);

      const dbTeam = await dbClient.team.findUnique({
        where: {
          id: team.id,
        },
      });

      return dbTeam?.stripeSubscriptionStatus === SubscriptionStatus.ACTIVE;
    }

    return true; // on a paid plan
  }

  return false; // not on a paid plan
};

export const fileCountForTeam = async (
  team: Team | DecryptedTeam,
  userId: number
): Promise<{ totalTeamFiles: number; userPrivateFiles: number }> => {
  const totalTeamFiles = await dbClient.file.count({
    where: {
      ownerTeamId: team.id,
      deleted: false,
      ownerUserId: null,
    },
  });

  const userPrivateFiles = await dbClient.file.count({
    where: {
      ownerTeamId: team.id,
      ownerUserId: userId,
      deleted: false,
    },
  });

  return { totalTeamFiles, userPrivateFiles };
};

/// Returns true if the user has reached its file limit and requires a paid plan
/// to continue adding files
/// If isPrivate is provided, only checks the relevant limit for that file type
/// If isPrivate is not provided, checks against team file limit
export const hasReachedFileLimit = async (
  team: Team | DecryptedTeam,
  userId: number,
  isPrivate?: boolean
): Promise<boolean> => {
  const isPaidPlan = await getIsOnPaidPlan(team);
  logger.info(`isPaidPlan: ${isPaidPlan}, MAX_FILE_COUNT_FOR_PAID_PLAN: ${MAX_FILE_COUNT_FOR_PAID_PLAN}`);
  if (isPaidPlan || !MAX_FILE_COUNT_FOR_PAID_PLAN) {
    return false;
  }

  const { totalTeamFiles, userPrivateFiles } = await fileCountForTeam(team, userId);
  const [maxTotalFiles, maxUserPrivateFiles] = MAX_FILE_COUNT_FOR_PAID_PLAN;

  logger.info(
    `totalTeamFiles: ${totalTeamFiles}, userPrivateFiles: ${userPrivateFiles}, maxTotalFiles: ${maxTotalFiles}, maxUserPrivateFiles: ${maxUserPrivateFiles}`
  );

  if (!isPrivate) {
    return totalTeamFiles >= maxTotalFiles;
  }

  return userPrivateFiles >= maxUserPrivateFiles;
};
