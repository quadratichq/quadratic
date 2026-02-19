import type { Response } from 'express';
import type { ApiTypes, FilePermission } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { licenseClient } from '../../licenseClient';
import { getFile } from '../../middleware/getFile';
import { userOptionalMiddleware } from '../../middleware/user';
import { validateOptionalAccessToken } from '../../middleware/validateOptionalAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { getFileUrl } from '../../storage/storage';
import { updateBilling } from '../../stripe/stripe';
import type { RequestWithOptionalUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { getIsOnPaidPlan, requiresUpgradeToEdit } from '../../utils/billing';
import { isRestrictedModelCountry } from '../../utils/geolocation';
import { getDecryptedTeam } from '../../utils/teams';
import { getUserClientDataKv } from '../../utils/userClientData';

export default [
  validateRequestSchema(
    z.object({
      params: z.object({
        uuid: z.string().uuid(),
      }),
    })
  ),
  validateOptionalAccessToken,
  userOptionalMiddleware,
  handler,
];

async function handler(req: RequestWithOptionalUser, res: Response<ApiTypes['/v0/files/:uuid.GET.response']>) {
  const userId = req.user?.id;
  const {
    file: { id, thumbnail, uuid, name, createdDate, updatedDate, publicLinkAccess, ownerUserId, ownerTeam, timezone },
    userMakingRequest: { filePermissions, fileRole, teamRole, teamPermissions },
  } = await getFile({ uuid: req.params.uuid, userId });

  const thumbnailSignedUrl = thumbnail ? await getFileUrl(thumbnail) : null;

  // Apply SSH keys to the team if they don't already exist.
  const decryptedTeam = await getDecryptedTeam(ownerTeam);

  if (decryptedTeam.sshPublicKey === null) {
    throw new ApiError(500, 'Unable to retrieve SSH keys');
  }

  // Update billing info to ensure we have the latest subscription status
  // Only do this if we're checking for a subscription update after checkout
  if (req.query.updateBilling === 'true') {
    await updateBilling(ownerTeam);
    // Re-fetch the team to get the updated subscription status
    const updatedTeam = await dbClient.team.findUnique({
      where: { id: ownerTeam.id },
    });
    if (updatedTeam) {
      // Update the ownerTeam's billing fields with fresh data from DB
      ownerTeam.stripeSubscriptionStatus = updatedTeam.stripeSubscriptionStatus;
      ownerTeam.stripeCurrentPeriodEnd = updatedTeam.stripeCurrentPeriodEnd;
      ownerTeam.stripeSubscriptionId = updatedTeam.stripeSubscriptionId;
      ownerTeam.planType = updatedTeam.planType;
    }
  }

  const isOnPaidPlan = await getIsOnPaidPlan(ownerTeam);

  // Check if this file is edit-restricted due to billing limits (soft file limit)
  // For free teams, only the N most recently created files are editable
  const isEditRestricted = await requiresUpgradeToEdit(ownerTeam, id);

  // Apply edit restriction to permissions if necessary
  let finalFilePermissions: FilePermission[] = filePermissions;
  if (isEditRestricted && filePermissions.includes('FILE_EDIT')) {
    finalFilePermissions = filePermissions.filter((p) => p !== 'FILE_EDIT');
  }

  // Get the most recent checkpoint for the file
  const checkpoint = await dbClient.fileCheckpoint.findFirst({
    where: {
      fileId: id,
    },
    orderBy: {
      sequenceNumber: 'desc',
    },
  });

  if (!checkpoint) {
    throw new ApiError(500, 'No Checkpoints exist for this file');
  }
  const lastCheckpointDataUrl = await getFileUrl(checkpoint.s3Key);

  // Check if the file has any active scheduled tasks
  const scheduledTask = await dbClient.scheduledTask.findFirst({
    where: {
      fileId: id,
      status: { not: 'DELETED' },
    },
    select: { id: true },
  });
  const hasScheduledTasks = scheduledTask !== null;

  // Privacy of the file as it relates to the user making the request.
  // `undefined` means it was shared _somehow_, e.g. direct invite or public link,
  // but the user doesn't have access to the file's team
  let fileTeamPrivacy: ApiTypes['/v0/files/:uuid.GET.response']['userMakingRequest']['fileTeamPrivacy'] = undefined;
  if (ownerUserId === userId) {
    fileTeamPrivacy = 'PRIVATE_TO_ME';
  } else if (ownerUserId !== null && teamRole) {
    fileTeamPrivacy = 'PRIVATE_TO_SOMEONE_ELSE';
  } else if (ownerUserId === null && teamRole) {
    fileTeamPrivacy = 'PUBLIC_TO_TEAM';
  }

  const license = await licenseClient.check(false);

  if (license === null) {
    throw new ApiError(500, 'Unable to retrieve license');
  }

  const clientDataKv = await getUserClientDataKv(userId);

  const data: ApiTypes['/v0/files/:uuid.GET.response'] = {
    file: {
      uuid,
      name,
      createdDate: createdDate.toISOString(),
      updatedDate: updatedDate.toISOString(),
      publicLinkAccess,
      lastCheckpointSequenceNumber: checkpoint.sequenceNumber,
      lastCheckpointVersion: checkpoint.version,
      lastCheckpointDataUrl,
      thumbnail: thumbnailSignedUrl,
      ownerUserId: ownerUserId ? ownerUserId : undefined,
      timezone: timezone ?? null,
      hasScheduledTasks,
    },
    team: {
      uuid: ownerTeam.uuid,
      name: ownerTeam.name,
      isOnPaidPlan,
      planType: ownerTeam.planType ?? undefined,
      settings: {
        analyticsAi: ownerTeam.settingAnalyticsAi,
      },
      sshPublicKey: decryptedTeam.sshPublicKey,
    },
    userMakingRequest: {
      clientDataKv,
      id: userId,
      filePermissions: finalFilePermissions,
      fileRole,
      fileTeamPrivacy,
      teamRole,
      teamPermissions,
      restrictedModel: isRestrictedModelCountry(req, isOnPaidPlan),
      requiresUpgradeToEdit: isEditRestricted,
    },
    license,
  };

  return res.status(200).json(data);
}
