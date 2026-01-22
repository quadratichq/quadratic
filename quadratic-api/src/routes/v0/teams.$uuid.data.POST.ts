import type { Response } from 'express';
import type { DataAssetType } from 'quadratic-shared/typesAndSchemas';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { v4 as uuidv4 } from 'uuid';
import z from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { S3Bucket } from '../../storage/s3';
import { uploadMiddleware } from '../../storage/storage';
import type { RequestWithFile, RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

/**
 * Determine the DataAssetType based on file extension and MIME type
 */
function getDataAssetType(filename: string, mimeType: string): DataAssetType {
  const ext = filename.toLowerCase().split('.').pop() || '';

  // Check by extension first
  if (ext === 'csv') return 'CSV';
  if (['xlsx', 'xls'].includes(ext)) return 'EXCEL';
  if (['parquet', 'parq', 'pqt'].includes(ext)) return 'PARQUET';
  if (ext === 'pdf') return 'PDF';
  if (ext === 'json') return 'JSON';

  // Fallback to MIME type
  if (mimeType === 'text/csv' || mimeType === 'application/csv') return 'CSV';
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel'
  )
    return 'EXCEL';
  if (mimeType === 'application/vnd.apache.parquet') return 'PARQUET';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType === 'application/json') return 'JSON';

  return 'OTHER';
}

async function handler(req: RequestWithUser & RequestWithFile, res: Response) {
  const {
    params: { uuid: teamUuid },
    user: { id: userId },
    body,
  } = req;

  const {
    team: { id: teamId },
    userMakingRequest: { permissions },
  } = await getTeam({ uuid: teamUuid, userId });

  // Do you have permission to add data?
  if (!permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You don't have permission to upload data to this team');
  }

  // Validate file was uploaded
  if (!req.file) {
    throw new ApiError(400, 'No file uploaded');
  }

  const file = req.file;
  const isPrivate = body.isPrivate === 'true' || body.isPrivate === true;
  const customName = body.name?.trim();

  // Determine file type
  const type = getDataAssetType(file.originalname, file.mimetype);

  // Generate a unique key for S3
  const dataUuid = uuidv4();
  const s3Key = `${teamUuid}/${dataUuid}/${file.originalname}`;

  // Create the data asset record
  const dataAsset = await dbClient.dataAsset.create({
    data: {
      uuid: dataUuid,
      name: customName || file.originalname,
      type,
      mimeType: file.mimetype,
      size: file.size,
      s3Bucket: S3Bucket.DATA,
      s3Key: file.key || s3Key,
      creatorUserId: userId,
      ownerUserId: isPrivate ? userId : null,
      ownerTeamId: teamId,
    },
    select: {
      uuid: true,
      name: true,
      type: true,
    },
  });

  const response: ApiTypes['/v0/teams/:uuid/data.POST.response'] = {
    dataAsset,
  };

  return res.status(201).json(response);
}

export default [
  validateRequestSchema(schema),
  validateAccessToken,
  userMiddleware,
  uploadMiddleware(S3Bucket.DATA).single('file'),
  handler,
];
