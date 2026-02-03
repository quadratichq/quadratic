import type { Team } from '@prisma/client';
import { SubscriptionStatus } from '@prisma/client';
import dbClient from '../dbClient';
import { FREE_EDITABLE_FILE_LIMIT, isRunningInTest } from '../env-vars';
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

/**
 * Get the maximum number of editable files for free teams.
 */
export const getFreeEditableFileLimit = (): number => {
  return FREE_EDITABLE_FILE_LIMIT;
};

/**
 * Internal helper to get editable file IDs when isPaidPlan is already known.
 * Avoids redundant getIsOnPaidPlan calls.
 */
const getEditableFileIdsInternal = async (
  team: Team | DecryptedTeam,
  isPaidPlan: boolean
): Promise<{ editableFileIds: number[]; allFileIds?: number[] }> => {
  if (isPaidPlan) {
    // Paid teams can edit all files - return all file IDs
    const allFiles = await dbClient.file.findMany({
      where: {
        ownerTeamId: team.id,
        deleted: false,
      },
      select: { id: true },
    });
    const fileIds = allFiles.map((f) => f.id);
    return { editableFileIds: fileIds, allFileIds: fileIds };
  }

  // Free teams: return only the N most recently created file IDs
  const limit = getFreeEditableFileLimit();
  const editableFiles = await dbClient.file.findMany({
    where: {
      ownerTeamId: team.id,
      deleted: false,
    },
    orderBy: {
      createdDate: 'desc',
    },
    take: limit,
    select: { id: true },
  });

  return { editableFileIds: editableFiles.map((f) => f.id) };
};

/**
 * Get the IDs of files that are editable for a team.
 * For free teams, returns the N most recently created file IDs.
 * For paid teams, returns all file IDs.
 */
export const getEditableFileIds = async (team: Team | DecryptedTeam): Promise<number[]> => {
  const isPaidPlan = await getIsOnPaidPlan(team);
  const { editableFileIds } = await getEditableFileIdsInternal(team, isPaidPlan);
  return editableFileIds;
};

/**
 * Check if a specific file requires upgrade to edit due to billing limits (soft file limit).
 * Returns true if the file is NOT in the top N most recently created files for free teams.
 *
 * IMPORTANT: This is distinct from permission-based "View only" access:
 * - "View only" (permission-based): User doesn't have FILE_EDIT permission due to sharing settings
 * - "Upgrade to edit" (billing-based): User would have FILE_EDIT permission, but it's restricted
 *   because the team is on a free plan and this file exceeds the editable file limit
 *
 * When this returns true, the UI should show "Upgrade to edit" messaging rather than "View only"
 */
export const requiresUpgradeToEdit = async (team: Team | DecryptedTeam, fileId: number): Promise<boolean> => {
  const isPaidPlan = await getIsOnPaidPlan(team);
  if (isPaidPlan) {
    return false;
  }

  const { editableFileIds } = await getEditableFileIdsInternal(team, isPaidPlan);
  return !editableFileIds.includes(fileId);
};

/**
 * Get file limit information for a team.
 * Returns whether the team is over the editable file limit and related counts.
 * @param team - The team to check
 * @param isPaidPlan - Optional: pass in the result of getIsOnPaidPlan() to avoid redundant lookup
 */
export const getFileLimitInfo = async (
  team: Team | DecryptedTeam,
  isPaidPlan?: boolean
): Promise<{
  isOverLimit: boolean;
  totalFiles: number;
  maxEditableFiles: number;
  editableFileIds: number[];
}> => {
  const isPaid = isPaidPlan ?? (await getIsOnPaidPlan(team));

  if (isPaid) {
    // Paid teams have no limit - single query to get all file IDs
    const { editableFileIds, allFileIds } = await getEditableFileIdsInternal(team, isPaid);
    return {
      isOverLimit: false,
      totalFiles: allFileIds!.length,
      maxEditableFiles: Infinity,
      editableFileIds,
    };
  }

  // Free teams: need total count and editable file IDs
  // Run both queries in parallel to minimize latency
  const [totalFiles, { editableFileIds }] = await Promise.all([
    dbClient.file.count({
      where: {
        ownerTeamId: team.id,
        deleted: false,
      },
    }),
    getEditableFileIdsInternal(team, isPaid),
  ]);

  const maxEditableFiles = getFreeEditableFileLimit();

  return {
    isOverLimit: totalFiles > maxEditableFiles,
    totalFiles,
    maxEditableFiles,
    editableFileIds,
  };
};

