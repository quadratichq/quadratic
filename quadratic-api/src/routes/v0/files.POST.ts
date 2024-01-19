import { Response } from 'express';
import { ApiSchemas, ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { uploadStringAsFileS3 } from '../../aws/s3';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';

export default [
  validateRequestSchema(
    z.object({
      body: ApiSchemas['/v0/files.POST.request'],
    })
  ),
  validateAccessToken,
  userMiddleware,
  handler,
];

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/files.POST.response']>) {
  const {
    user: { id: userId },
    body: { name, contents, version },
  } = req;

  // Create file in db
  const dbFile = await dbClient.file.create({
    data: {
      creatorUserId: userId,
      ownerUserId: userId,
      name,
    },
    select: {
      id: true,
      uuid: true,
      name: true,
      createdDate: true,
      updatedDate: true,
    },
  });

  // Upload file contents to S3 and create a checkpoint
  const { uuid } = dbFile;
  const response = await uploadStringAsFileS3(`${uuid}-0.grid`, contents);

  await dbClient.fileCheckpoint.create({
    data: {
      fileId: dbFile.id,
      sequenceNumber: 0,
      s3Bucket: response.bucket,
      s3Key: response.key,
      version: version,
    },
  });

  return res.status(201).json({
    ...dbFile,
    createdDate: dbFile.createdDate.toISOString(),
    updatedDate: dbFile.updatedDate.toISOString(),
  });
}
