import multer, { StorageEngine } from 'multer';
import multerS3 from 'multer-s3';
import { s3Client } from '../aws/s3';
import { Request, RequestWithQuadraticFile } from '../types/Request';

// Initialize multer
export const uploadThumbnailToS3: multer.Multer = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.AWS_S3_BUCKET_NAME as string,
    metadata: (req: Request, file: Express.Multer.File, cb: (error: Error | null, metadata: any) => void) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req: RequestWithQuadraticFile, file: Express.Multer.File, cb: (error: Error | null, key: string) => void) => {
      cb(null, `${req.quadraticFile.uuid}-${file.originalname}`);
    },
  }) as StorageEngine,
});
