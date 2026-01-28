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

  const needsBillingSync =
    // If status is INCOMPLETE (checkout in progress, webhook may be delayed), sync with Stripe
    team.stripeSubscriptionStatus === SubscriptionStatus.INCOMPLETE ||
    // If the team is on a paid plan, but the current period has ended, update the billing info
    (team.stripeSubscriptionStatus === SubscriptionStatus.ACTIVE &&
      !!team.stripeCurrentPeriodEnd &&
      team.stripeCurrentPeriodEnd < new Date());

  if (needsBillingSync) {
    await updateBilling(team);

    // Re-fetch team from database to get updated status
    const dbTeam = await dbClient.team.findUnique({
      where: {
        id: team.id,
      },
    });

    return dbTeam?.stripeSubscriptionStatus === SubscriptionStatus.ACTIVE;
  }

  return team.stripeSubscriptionStatus === SubscriptionStatus.ACTIVE;
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
  if (isPaidPlan || !MAX_FILE_COUNT_FOR_PAID_PLAN) {
    return false;
  }

  const { totalTeamFiles, userPrivateFiles } = await fileCountForTeam(team, userId);
  const [maxTotalFiles, maxUserPrivateFiles] = MAX_FILE_COUNT_FOR_PAID_PLAN;

  if (!isPrivate) {
    return totalTeamFiles >= maxTotalFiles;
  }

  return userPrivateFiles >= maxUserPrivateFiles;
};
