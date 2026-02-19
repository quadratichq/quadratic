import type { SubscriptionStatus } from '@prisma/client';
import type { Request, Response } from 'express';
import type { ApiTypes, FilePermission } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { getUsers } from '../../auth/providers/auth';
import { BillingAIUsageMonthlyForUserInTeam } from '../../billing/AIUsageHelpers';
import { getPlanType } from '../../billing/planHelpers';
import dbClient from '../../dbClient';
import { licenseClient } from '../../licenseClient';
import { getTeam } from '../../middleware/getTeam';
import { getTeamConnectionsList } from '../../middleware/getTeamConnectionsList';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { getPresignedFileUrl } from '../../storage/storage';
import { updateBilling } from '../../stripe/stripe';
import type { RequestWithUser } from '../../types/Request';
import type { ResponseError } from '../../types/Response';
import { ApiError } from '../../utils/ApiError';
import { getFileLimitInfo, getFreeEditableFileLimit, getIsOnPaidPlan } from '../../utils/billing';
import { getFilePermissions } from '../../utils/permissions';
import { getDecryptedTeam } from '../../utils/teams';

// Statuses that indicate the subscription may need to be synced with Stripe:
// - INCOMPLETE: checkout in progress, webhook may be delayed
// - INCOMPLETE_EXPIRED: previous attempt failed, user may have retried with a new subscription
const NEEDS_SYNC_STATUSES: SubscriptionStatus[] = ['INCOMPLETE', 'INCOMPLETE_EXPIRED'];

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

async function handler(req: Request, res: Response<ApiTypes['/v0/teams/:uuid.GET.response'] | ResponseError>) {
  const {
    params: { uuid },
  } = parseRequest(req, schema);
  const {
    user: { id: userMakingRequestId },
  } = req as RequestWithUser;
  const { team, userMakingRequest } = await getTeam({ uuid, userId: userMakingRequestId });

  // Update billing info to ensure we have the latest subscription status
  // Do this if: 1) explicitly requested, or 2) status indicates subscription may be stale
  const shouldUpdateBilling =
    req.query.updateBilling === 'true' ||
    (team.stripeSubscriptionStatus !== null && NEEDS_SYNC_STATUSES.includes(team.stripeSubscriptionStatus));

  if (shouldUpdateBilling) {
    await updateBilling(team);
  }

  // Get data associated with the file
  const dbTeam = await dbClient.team.findUnique({
    where: {
      id: team.id,
    },
    include: {
      Connection: {
        where: {
          archived: null,
        },
        orderBy: {
          createdDate: 'desc',
        },
        include: {
          SyncedConnection: {
            select: {
              percentCompleted: true,
              updatedDate: true,
              SyncedConnectionLog: {
                select: { status: true, error: true },
                orderBy: { createdDate: 'desc' },
                take: 1,
              },
            },
          },
        },
      },
      UserTeamRole: {
        include: {
          user: true,
        },
        orderBy: {
          createdDate: 'asc',
        },
      },
      TeamInvite: {
        orderBy: {
          createdDate: 'asc',
        },
      },
      File: {
        where: {
          ownerTeamId: team.id,
          deleted: false,
          // Don't return files that are private to other users
          // (one of these must return true)
          OR: [
            { ownerUserId: null }, // Public files to the team
            { ownerUserId: userMakingRequestId }, // Private files to the user
          ],
        },
        include: {
          UserFileRole: {
            where: {
              userId: userMakingRequestId,
            },
          },
          ScheduledTask: {
            where: {
              status: { not: 'DELETED' },
            },
            select: {
              id: true,
            },
            take: 1,
          },
        },
        orderBy: {
          createdDate: 'asc',
        },
      },
    },
  });

  if (!dbTeam) {
    return res.status(404).send();
  }

  const dbFiles = dbTeam.File ? dbTeam.File : [];
  const dbUsers = dbTeam.UserTeamRole ? dbTeam.UserTeamRole : [];
  const dbInvites = dbTeam.TeamInvite ? dbTeam.TeamInvite : [];
  const dbConnections = dbTeam.Connection ? dbTeam.Connection : [];

  // Get user info from auth
  const authUsersById = await getUsers(dbUsers.map(({ user }) => user));

  // IDEA: (enhancement) we could put this in /sharing and just return the userCount
  // then require the data for the team share modal to be a separate network request
  const users = dbUsers
    .filter(({ userId: id }) => authUsersById[id])
    .map(({ userId: id, role }) => {
      const { email, name, picture } = authUsersById[id];
      return {
        id,
        email,
        role,
        name,
        picture,
      };
    });

  const license = await licenseClient.check(false);

  if (!license) {
    throw new ApiError(500, 'Unable to retrieve license');
  }

  // Apply SSH keys to the team if they don't already exist.
  const decryptedTeam = await getDecryptedTeam(dbTeam);

  // Get signed thumbnail URLs
  await Promise.all(
    dbFiles.map(async (file) => {
      if (file.thumbnail) {
        file.thumbnail = await getPresignedFileUrl(file.thumbnail);
      }
    })
  );

  const usage = await BillingAIUsageMonthlyForUserInTeam(userMakingRequestId, team.id);

  // Get plan type from the re-fetched team to reflect any updateBilling changes
  const planType = getPlanType(dbTeam);

  // Get file limit info (includes editable file IDs and whether team is over limit)
  // For free teams, only the N most recently created files are editable
  // Use dbTeam (re-fetched after potential updateBilling) to avoid stale billing data
  const isPaidPlan = await getIsOnPaidPlan(dbTeam);
  const { editableFileIds, isOverLimit, totalFiles } = await getFileLimitInfo(dbTeam, isPaidPlan);

  // Helper to apply edit restriction to file permissions
  const applyEditRestriction = (fileId: number, permissions: FilePermission[]): FilePermission[] => {
    if (!editableFileIds.includes(fileId) && permissions.includes('FILE_EDIT')) {
      return permissions.filter((p) => p !== 'FILE_EDIT');
    }
    return permissions;
  };

  const response = {
    team: {
      id: team.id,
      uuid,
      name: team.name,
      // Onboarding is considered complete if: 1) the value is true, or 2) the value is null (legacy)
      onboardingComplete: dbTeam.onboardingComplete !== false,
      settings: {
        analyticsAi: dbTeam.settingAnalyticsAi,
        aiRules: dbTeam.aiRules ?? null,
      },
      sshPublicKey: decryptedTeam.sshPublicKey,
    },
    billing: {
      status: dbTeam.stripeSubscriptionStatus || undefined,
      currentPeriodEnd: dbTeam.stripeCurrentPeriodEnd?.toISOString(),
      planType,
      usage,
    },
    userMakingRequest: {
      id: userMakingRequestId,
      teamRole: userMakingRequest.role,
      teamPermissions: userMakingRequest.permissions,
    },
    users,
    invites: dbInvites.map(({ email, role, id }) => ({ email, role, id })),
    files: dbFiles
      .filter((file) => !file.ownerUserId)
      .map((file) => {
        const basePermissions = getFilePermissions({
          publicLinkAccess: file.publicLinkAccess,
          userFileRelationship: {
            context: 'public-to-team',
            teamRole: userMakingRequest.role,
            fileRole: file.UserFileRole.find(({ userId }) => userId === userMakingRequestId)?.role,
          },
        });
        const isEditRestricted = !editableFileIds.includes(file.id);
        return {
          file: {
            uuid: file.uuid,
            name: file.name,
            createdDate: file.createdDate.toISOString(),
            updatedDate: file.updatedDate.toISOString(),
            publicLinkAccess: file.publicLinkAccess,
            thumbnail: file.thumbnail,
            creatorId: file.creatorUserId,
            hasScheduledTasks: file.ScheduledTask.length > 0,
          },
          userMakingRequest: {
            filePermissions: applyEditRestriction(file.id, basePermissions),
            requiresUpgradeToEdit: isEditRestricted,
          },
        };
      }),
    filesPrivate: dbFiles
      .filter((file) => file.ownerUserId)
      .map((file) => {
        const basePermissions = getFilePermissions({
          publicLinkAccess: file.publicLinkAccess,
          userFileRelationship: {
            context: 'private-to-me',
            teamRole: userMakingRequest.role,
          },
        });
        const isEditRestricted = !editableFileIds.includes(file.id);
        return {
          file: {
            uuid: file.uuid,
            name: file.name,
            createdDate: file.createdDate.toISOString(),
            updatedDate: file.updatedDate.toISOString(),
            publicLinkAccess: file.publicLinkAccess,
            thumbnail: file.thumbnail,
            hasScheduledTasks: file.ScheduledTask.length > 0,
          },
          userMakingRequest: {
            filePermissions: applyEditRestriction(file.id, basePermissions),
            requiresUpgradeToEdit: isEditRestricted,
          },
        };
      }),
    license: { ...license },
    connections: getTeamConnectionsList({ dbConnections, settingShowConnectionDemo: team.settingShowConnectionDemo }),
    clientDataKv: isObject(dbTeam.clientDataKv) ? dbTeam.clientDataKv : {},
    fileLimit: {
      isOverLimit,
      totalFiles,
      maxEditableFiles: isPaidPlan ? undefined : getFreeEditableFileLimit(),
    },
  };

  return res.status(200).json(response);
}

function isObject(x: any): x is Record<string, any> {
  return typeof x === 'object' && !Array.isArray(x) && x !== null;
}
