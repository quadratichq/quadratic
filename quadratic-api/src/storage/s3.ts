import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Request } from 'express';
import type { StorageEngine } from 'multer';
import multer from 'multer';
import multerS3 from 'multer-s3';
import {
  AWS_S3_ACCESS_KEY_ID,
  AWS_S3_ANALYTICS_BUCKET_NAME,
  AWS_S3_BUCKET_NAME,
  AWS_S3_ENDPOINT,
  AWS_S3_REGION,
  AWS_S3_SECRET_ACCESS_KEY,
} from '../env-vars';
import type { UploadFileResponse } from './storage';

const endpoint = AWS_S3_ENDPOINT;
let s3Client: S3Client;

export enum S3Bucket {
  FILES = 'files',
  ANALYTICS = 'analytics',
}

export const getBucketName = (bucket: S3Bucket) => {
  switch (bucket) {
    case S3Bucket.FILES:
      return AWS_S3_BUCKET_NAME;
    case S3Bucket.ANALYTICS:
      return AWS_S3_ANALYTICS_BUCKET_NAME;
    default:
      throw new Error(`Unsupported bucket in getBucketName(): ${bucket}`);
  }
};

// Get S3 client singleton
const getS3Client = () => {
  if (!s3Client) {
    s3Client = new S3Client({
      region: AWS_S3_REGION,
      credentials: {
        accessKeyId: AWS_S3_ACCESS_KEY_ID,
        secretAccessKey: AWS_S3_SECRET_ACCESS_KEY,
      },
      ...(endpoint === undefined
        ? // for aws, using transfer acceleration
          {
            useAccelerateEndpoint: true,
          }
        : // for localstack, using path style
          {
            endpoint,
            forcePathStyle: true,
          }),
    });
  }

  return s3Client;
};

// Upload a string as a file to S3
export const uploadStringAsFileS3 = async (
  fileKey: string,
  contents: string,
  bucket: S3Bucket
): Promise<UploadFileResponse> => {
  const command = new PutObjectCommand({
    Bucket: getBucketName(bucket),
    Key: fileKey,
    Body: Uint8Array.from(Buffer.from(contents, 'base64')),
    // Optionally, you can add other configuration like ContentType
    // ContentType: 'text/plain'
  });
  const response = await getS3Client().send(command);

  // Check if the upload was successful
  if (response && response.$metadata.httpStatusCode === 200) {
    return {
      bucket: getBucketName(bucket),
      key: fileKey,
    };
  } else {
    throw new Error('Failed to upload file to S3');
  }
};

// Multer storage engine for S3
export const multerS3Storage = (bucket: S3Bucket): multer.Multer =>
  multer({
    storage: multerS3({
      s3: getS3Client(),
      bucket: getBucketName(bucket),
      metadata: (req: Request, file: Express.Multer.File, cb: (error: Error | null, metadata: any) => void) => {
        cb(null, { fieldName: file.fieldname });
      },
      key: (req: Request, file: Express.Multer.File, cb: (error: Error | null, key: string) => void) => {
        const fileUuid = req.params.uuid;
        cb(null, `${fileUuid}-${file.originalname}`);
      },
    }) as StorageEngine,
  });

// Get the presigned file URL from S3 (for downloads)
export const generatePresignedUrl = async (key: string, bucket: S3Bucket): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: getBucketName(bucket),
    Key: key,
  });

  return await getSignedUrl(getS3Client(), command, { expiresIn: 60 * 60 * 24 * 7 }); // 7 days
};

// Generate a presigned URL for uploading to S3
export const generatePresignedUploadUrl = async (
  key: string,
  bucket: S3Bucket,
  contentType: string = 'application/octet-stream'
): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: getBucketName(bucket),
    Key: key,
    ContentType: contentType,
  });

  return await getSignedUrl(getS3Client(), command, { expiresIn: 60 * 60 }); // 1 hour
};
