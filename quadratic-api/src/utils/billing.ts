import type { Team } from '@prisma/client';
import { SubscriptionStatus } from '@prisma/client';
import dbClient from '../dbClient';
import { isRunningInTest, MAX_FILE_COUNT_FOR_PAID_PLAN } from '../env-vars';
import { updateBilling } from '../stripe/stripe';
import type { DecryptedTeam } from '../utils/teams';

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
    },
  });

  const userPrivateFiles = await dbClient.file.count({
    where: {
      ownerTeamId: team.id,
      creatorUserId: userId,
      deleted: false,
    },
  });

  return { totalTeamFiles, userPrivateFiles };
};

/// Returns true if the team has reached its file limit and requires a paid plan
/// to continue adding files
export const teamHasReachedFileLimit = async (team: Team | DecryptedTeam, userId: number): Promise<boolean> => {
  const isPaidPlan = await getIsOnPaidPlan(team);

  if (isPaidPlan || !MAX_FILE_COUNT_FOR_PAID_PLAN) {
    return false;
  }

  const { totalTeamFiles, userPrivateFiles } = await fileCountForTeam(team, userId);
  const [maxTotalFiles, maxUserPrivateFiles] = MAX_FILE_COUNT_FOR_PAID_PLAN;

  return totalTeamFiles >= maxTotalFiles || userPrivateFiles >= maxUserPrivateFiles;
};
