import { Request, Response } from 'express';
import multer, { StorageEngine } from 'multer';
import multerS3 from 'multer-s3';
import { ApiTypes, FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { s3Client } from '../../aws/s3';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithFile, RequestWithUser } from '../../types/Request';
const { FILE_EDIT } = FilePermissionSchema.enum;

const uploadThumbnailToS3: multer.Multer = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.AWS_S3_BUCKET_NAME as string,
    metadata: (req: Request, file: Express.Multer.File, cb: (error: Error | null, metadata: any) => void) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req: Request, file: Express.Multer.File, cb: (error: Error | null, key: string) => void) => {
      const fileUuid = req.params.uuid;
      cb(null, `${fileUuid}-${file.originalname}`);
    },
  }) as StorageEngine,
});

async function handler(req: RequestWithUser & RequestWithFile, res: Response) {
  const {
    params: { uuid },
    user: { id: userId },
  } = req;
  const {
    userMakingRequest: { filePermissions },
  } = await getFile({ uuid, userId });

  if (!filePermissions.includes(FILE_EDIT)) {
    return res.status(403).json({ error: { message: 'Permission denied' } });
  }

  // update the file object with the thumbnail URL
  await dbClient.file.update({
    where: {
      uuid,
    },
    data: {
      thumbnail: req.file?.key,
      updatedDate: new Date(),
    },
  });

  const data: ApiTypes['/v0/files/:uuid/thumbnail.POST.response'] = { message: 'Preview updated' };
  return res.status(200).json(data);
}

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
  uploadThumbnailToS3.single('thumbnail'),
  handler,
];
