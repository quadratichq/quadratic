import type { Team } from '@prisma/client';
import { SubscriptionStatus } from '@prisma/client';
import dbClient from '../dbClient';
import { isRunningInTest } from '../env-vars';
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
