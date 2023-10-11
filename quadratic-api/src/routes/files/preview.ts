import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import multer, { StorageEngine } from 'multer';
import multerS3 from 'multer-s3';
import { Request } from '../../types/Request';

// if (
//   process.env.AWS_S3_REGION !== undefined ||
//   process.env.AWS_S3_ACCESS_KEY_ID !== undefined ||
//   process.env.AWS_S3_SECRET_ACCESS_KEY !== undefined ||
//   process.env.AWS_S3_BUCKET_NAME !== undefined
// ) {
//   console.log(process.env);
//   throw new Error('Missing AWS S3 environment variables');
// }

// Initialize S3 client
export const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  },
});

// Initialize multer
export const uploadPreviewToS3: multer.Multer = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    metadata: (req: Request, file: Express.Multer.File, cb: (error: Error | null, metadata: any) => void) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req: Request, file: Express.Multer.File, cb: (error: Error | null, key: string) => void) => {
      cb(null, `${req.document.uuid}-${file.originalname}`);
    },
  }) as StorageEngine,
});

// Get file URL
export const generatePresignedUrl = async (key: string) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
};
