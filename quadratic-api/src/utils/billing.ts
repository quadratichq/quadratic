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

const fileCountForTeam = async (team: Team | DecryptedTeam): Promise<number> => {
  return await dbClient.file.count({
    where: {
      ownerTeamId: team.id,
      deleted: false,
    },
  });
};

/// Returns true if the team has reached its file limit and requires a paid plan
/// to continue adding files
export const teamHasReachedFileLimit = async (team: Team | DecryptedTeam): Promise<boolean> => {
  const isPaidPlan = await getIsOnPaidPlan(team);

  if (isPaidPlan || !MAX_FILE_COUNT_FOR_PAID_PLAN) {
    return false;
  }

  const fileCount = await fileCountForTeam(team);
  return fileCount >= MAX_FILE_COUNT_FOR_PAID_PLAN;
};
