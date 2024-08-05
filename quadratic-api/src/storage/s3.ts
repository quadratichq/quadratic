import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Request } from 'express';
import multer, { StorageEngine } from 'multer';
import multerS3 from 'multer-s3';
import {
  AWS_S3_ACCESS_KEY_ID,
  AWS_S3_BUCKET_NAME,
  AWS_S3_REGION,
  AWS_S3_SECRET_ACCESS_KEY,
  ENVIRONMENT,
} from '../env-vars';
import { UploadFileResponse } from './storage';

const endpoint =
  ENVIRONMENT === 'docker' ? 'http://localstack:4566' : ENVIRONMENT === 'local' ? 'http://0.0.0.0:4566' : undefined;

// Initialize S3 client
export const s3Client = new S3Client({
  region: AWS_S3_REGION,
  credentials: {
    accessKeyId: AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: AWS_S3_SECRET_ACCESS_KEY,
  },
  endpoint,
  forcePathStyle: true,
});

// Upload a string as a file to S3
export const uploadStringAsFileS3 = async (fileKey: string, contents: string): Promise<UploadFileResponse> => {
  const command = new PutObjectCommand({
    Bucket: AWS_S3_BUCKET_NAME,
    Key: fileKey,
    Body: new Uint8Array(Buffer.from(contents, 'base64')),
    // Optionally, you can add other configuration like ContentType
    // ContentType: 'text/plain'
  });
  const response = await s3Client.send(command);

  // Check if the upload was successful
  if (response && response.$metadata.httpStatusCode === 200) {
    return {
      bucket: AWS_S3_BUCKET_NAME,
      key: fileKey,
    };
  } else {
    throw new Error('Failed to upload file to S3');
  }
};

// Multer storage engine for S3
export const multerS3Storage: multer.Multer = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: AWS_S3_BUCKET_NAME,
    metadata: (req: Request, file: Express.Multer.File, cb: (error: Error | null, metadata: any) => void) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req: Request, file: Express.Multer.File, cb: (error: Error | null, key: string) => void) => {
      const fileUuid = req.params.uuid;
      cb(null, `${fileUuid}-${file.originalname}`);
    },
  }) as StorageEngine,
});

// Get the presigned file URL from S3
export const generatePresignedUrl = async (key: string): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: AWS_S3_BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 60 * 60 * 24 * 7 }); // 7 days
};
