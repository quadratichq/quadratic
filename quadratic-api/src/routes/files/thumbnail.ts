import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import multer, { StorageEngine } from 'multer';
import multerS3 from 'multer-s3';
import { Request, RequestWithQuadraticFile } from '../../types/Request';

const region = process.env.AWS_S3_REGION as string;
const accessKeyId = process.env.AWS_S3_ACCESS_KEY_ID as string;
const secretAccessKey = process.env.AWS_S3_SECRET_ACCESS_KEY as string;

// Initialize S3 client
export const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

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

// Get file URL
export const generatePresignedUrl = async (key: string) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 60 * 60 * 24 * 7 }); // one week
};
