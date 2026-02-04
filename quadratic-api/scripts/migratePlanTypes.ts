/**
 * Data migration script to set plan types and allowances for existing teams.
 * 
 * This script:
 * 1. Sets FREE plan type for teams without active subscriptions
 * 2. Sets PRO plan type and $20/user allowance for teams with active subscriptions (default)
 * 3. Can be updated later to set BUSINESS plan type based on Stripe subscription metadata
 * 
 * Run with: npx tsx scripts/migratePlanTypes.ts
 */

import { PlanType } from '@prisma/client';
import { SubscriptionStatus } from '@prisma/client';
import dbClient from '../src/dbClient';

async function migratePlanTypes() {
  console.log('Starting plan type migration...');

  try {
    // Get all teams
    const teams = await dbClient.team.findMany({
      include: {
        UserTeamRole: true,
      },
    });

    console.log(`Found ${teams.length} teams to migrate`);

    let freeCount = 0;
    let proCount = 0;
    let businessCount = 0;

    for (const team of teams) {
      if (team.planType) {
        // Already has plan type set, skip
        continue;
      }

      if (team.stripeSubscriptionStatus === SubscriptionStatus.ACTIVE) {
        // Active subscription - default to PRO
        // TODO: Check Stripe subscription metadata to determine if BUSINESS
        const userCount = team.UserTeamRole.length;
        const monthlyAllowance = 20; // $20/user for Pro

        await dbClient.team.update({
          where: { id: team.id },
          data: {
            planType: PlanType.PRO,
            monthlyAiAllowancePerUser: monthlyAllowance,
          },
        });

        proCount++;
        console.log(`Set team ${team.id} to PRO plan with $${monthlyAllowance}/user allowance`);
      } else {
        // No active subscription - FREE plan
        await dbClient.team.update({
          where: { id: team.id },
          data: {
            planType: PlanType.FREE,
            monthlyAiAllowancePerUser: 0,
          },
        });

        freeCount++;
        console.log(`Set team ${team.id} to FREE plan`);
      }
    }

    console.log('\nMigration complete!');
    console.log(`- FREE plans: ${freeCount}`);
    console.log(`- PRO plans: ${proCount}`);
    console.log(`- BUSINESS plans: ${businessCount}`);
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await dbClient.$disconnect();
  }
}

// Run migration
migratePlanTypes()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
