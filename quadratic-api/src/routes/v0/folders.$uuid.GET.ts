import type { Response } from 'express';
import type { ApiTypes, FilePermission } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { getPresignedFileUrl } from '../../storage/storage';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { getFileLimitInfo, getIsOnPaidPlan } from '../../utils/billing';
import { getFilePermissions } from '../../utils/permissions';

export default [
  validateRequestSchema(
    z.object({
      params: z.object({
        uuid: z.string().uuid(),
      }),
    })
  ),
  validateAccessToken,
  userMiddleware,
  handler,
];

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/folders/:uuid.GET.response']>) {
  const {
    user: { id: userId },
  } = req;
  const folderUuid = req.params.uuid;

  // Get the folder
  const folder = await dbClient.folder.findUnique({
    where: { uuid: folderUuid },
    include: {
      parentFolder: true,
    },
  });

  if (!folder) {
    throw new ApiError(404, 'Folder not found.');
  }

  // Check that the user has access to this team
  const folderTeam = await dbClient.team.findUnique({ where: { id: folder.ownerTeamId } });
  if (!folderTeam) {
    throw new ApiError(404, 'Team not found.');
  }

  const { userMakingRequest: teamUserMakingRequest } = await getTeam({ uuid: folderTeam.uuid, userId });

  // Check if the folder is private to another user
  if (folder.ownerUserId && folder.ownerUserId !== userId) {
    throw new ApiError(403, 'You do not have access to this folder.');
  }

  // Build breadcrumbs in memory from a single query (avoid N+1)
  const teamFolders = await dbClient.folder.findMany({
    where: { ownerTeamId: folder.ownerTeamId },
    select: { id: true, uuid: true, name: true, parentFolderId: true },
  });
  const folderById = new Map(teamFolders.map((f) => [f.id, f]));
  const breadcrumbs: { uuid: string; name: string }[] = [];
  let current: (typeof teamFolders)[0] | undefined = folder;
  while (current?.parentFolderId) {
    const parent = folderById.get(current.parentFolderId);
    if (!parent) break;
    breadcrumbs.unshift({ uuid: parent.uuid, name: parent.name });
    current = parent;
  }

  // Get subfolders
  const subfolders = await dbClient.folder.findMany({
    where: {
      parentFolderId: folder.id,
      // Only show folders the user has access to
      OR: [{ ownerUserId: null }, { ownerUserId: userId }],
    },
    orderBy: { name: 'asc' },
  });

  // Get files in this folder
  const dbFiles = await dbClient.file.findMany({
    where: {
      folderId: folder.id,
      deleted: false,
      OR: [{ ownerUserId: null }, { ownerUserId: userId }],
    },
    include: {
      UserFileRole: {
        where: { userId },
      },
      ScheduledTask: {
        where: { status: { not: 'DELETED' } },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { updatedDate: 'desc' },
  });

  // Get signed thumbnail URLs (non-mutating Promise.all, then assign)
  const signedThumbnails = await Promise.all(
    dbFiles.map(async (file) =>
      file.thumbnail ? getPresignedFileUrl(file.thumbnail) : null
    )
  );
  dbFiles.forEach((file, i) => {
    file.thumbnail = signedThumbnails[i];
  });

  // Get file limit info for edit restrictions
  const isPaidPlan = await getIsOnPaidPlan(folderTeam);
  const { editableFileIds } = await getFileLimitInfo(folderTeam, isPaidPlan);

  const applyEditRestriction = (fileId: number, permissions: FilePermission[]): FilePermission[] => {
    if (!editableFileIds.includes(fileId) && permissions.includes('FILE_EDIT')) {
      return permissions.filter((p) => p !== 'FILE_EDIT');
    }
    return permissions;
  };

  const publicFiles = dbFiles
    .filter((file) => !file.ownerUserId)
    .map((file) => {
      const basePermissions = getFilePermissions({
        publicLinkAccess: file.publicLinkAccess,
        userFileRelationship: {
          context: 'public-to-team',
          teamRole: teamUserMakingRequest.role,
          fileRole: file.UserFileRole.find(({ userId: uid }) => uid === userId)?.role,
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
          folderUuid: folder.uuid,
        },
        userMakingRequest: {
          filePermissions: applyEditRestriction(file.id, basePermissions),
          requiresUpgradeToEdit: isEditRestricted,
        },
      };
    });

  const privateFiles = dbFiles
    .filter((file) => file.ownerUserId)
    .map((file) => {
      const basePermissions = getFilePermissions({
        publicLinkAccess: file.publicLinkAccess,
        userFileRelationship: {
          context: 'private-to-me',
          teamRole: teamUserMakingRequest.role,
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
          folderUuid: folder.uuid,
        },
        userMakingRequest: {
          filePermissions: applyEditRestriction(file.id, basePermissions),
          requiresUpgradeToEdit: isEditRestricted,
        },
      };
    });

  return res.status(200).json({
    folder: {
      uuid: folder.uuid,
      name: folder.name,
      parentFolderUuid: folder.parentFolder?.uuid ?? null,
      ownerUserId: folder.ownerUserId ?? null,
    },
    breadcrumbs,
    subfolders: subfolders.map((sf) => ({
      uuid: sf.uuid,
      name: sf.name,
    })),
    files: publicFiles,
    filesPrivate: privateFiles,
  });
}
