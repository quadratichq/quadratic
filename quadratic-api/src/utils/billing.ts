import type { Team } from '@prisma/client';
import { SubscriptionStatus } from '@prisma/client';
import dbClient from '../dbClient';
import { isRunningInTest, MAX_FILE_COUNT_FOR_PAID_PLAN } from '../env-vars';
import { updateBilling } from '../stripe/stripe';
import type { DecryptedTeam } from '../utils/teams';

// Default number of editable files for free teams
const DEFAULT_FREE_EDITABLE_FILE_LIMIT = 3;

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

/**
 * Get the maximum number of editable files for free teams.
 * Supports both new format (single number "3") and legacy format ("3,2").
 */
export const getFreeEditableFileLimit = (): number => {
  if (!MAX_FILE_COUNT_FOR_PAID_PLAN) {
    return DEFAULT_FREE_EDITABLE_FILE_LIMIT;
  }
  // Use the first value (which was previously totalTeamFiles limit)
  return MAX_FILE_COUNT_FOR_PAID_PLAN[0] ?? DEFAULT_FREE_EDITABLE_FILE_LIMIT;
};

/**
 * Get the IDs of files that are editable for a team.
 * For free teams, returns the N most recently created file IDs.
 * For paid teams, returns all file IDs.
 */
export const getEditableFileIds = async (team: Team | DecryptedTeam): Promise<number[]> => {
  const isPaidPlan = await getIsOnPaidPlan(team);

  if (isPaidPlan) {
    // Paid teams can edit all files - return all file IDs
    const allFiles = await dbClient.file.findMany({
      where: {
        ownerTeamId: team.id,
        deleted: false,
      },
      select: {
        id: true,
      },
    });
    return allFiles.map((f) => f.id);
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
    select: {
      id: true,
    },
  });

  return editableFiles.map((f) => f.id);
};

/**
 * Check if a specific file has edit restrictions due to billing limits.
 * Returns true if the file is NOT in the top N most recently created files for free teams.
 */
export const isFileEditRestricted = async (team: Team | DecryptedTeam, fileId: number): Promise<boolean> => {
  const isPaidPlan = await getIsOnPaidPlan(team);
  if (isPaidPlan) {
    return false;
  }

  const editableFileIds = await getEditableFileIds(team);
  return !editableFileIds.includes(fileId);
};

/**
 * Get file limit information for a team.
 * Returns whether the team is over the editable file limit and related counts.
 */
export const getFileLimitInfo = async (
  team: Team | DecryptedTeam
): Promise<{
  isOverLimit: boolean;
  totalFiles: number;
  maxEditableFiles: number;
  editableFileIds: number[];
}> => {
  const isPaidPlan = await getIsOnPaidPlan(team);

  const totalFiles = await dbClient.file.count({
    where: {
      ownerTeamId: team.id,
      deleted: false,
    },
  });

  if (isPaidPlan) {
    // Paid teams have no limit
    const allFiles = await dbClient.file.findMany({
      where: {
        ownerTeamId: team.id,
        deleted: false,
      },
      select: { id: true },
    });
    return {
      isOverLimit: false,
      totalFiles,
      maxEditableFiles: Infinity,
      editableFileIds: allFiles.map((f) => f.id),
    };
  }

  const maxEditableFiles = getFreeEditableFileLimit();
  const editableFileIds = await getEditableFileIds(team);

  return {
    isOverLimit: totalFiles >= maxEditableFiles,
    totalFiles,
    maxEditableFiles,
    editableFileIds,
  };
};

// Legacy functions below - kept for backward compatibility during migration

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

/**
 * @deprecated Use getFileLimitInfo instead for new soft limit behavior.
 * This function is kept for backward compatibility.
 * Returns true if the team has reached the file limit (for blocking behavior).
 */
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
