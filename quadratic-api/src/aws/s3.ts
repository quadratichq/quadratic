import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const region = process.env.AWS_S3_REGION as string;
const accessKeyId = process.env.AWS_S3_ACCESS_KEY_ID as string;
const secretAccessKey = process.env.AWS_S3_SECRET_ACCESS_KEY as string;
const bucketName = process.env.AWS_S3_BUCKET_NAME as string;
const isLocal = (process.env.ENVIRONMENT as string) === 'local';
const isDocker = (process.env.ENVIRONMENT as string) === 'docker';
const endpoint = isDocker ? 'http://localstack:4566' : isLocal ? 'http://0.0.0.0:4566' : undefined;

// Initialize S3 client
export const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  endpoint,
  forcePathStyle: true,
});

export const uploadStringAsFileS3 = async (fileKey: string, contents: string) => {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
    Body: contents,
    // Optionally, you can add other configuration like ContentType
    // ContentType: 'text/plain'
  });
  const response = await s3Client.send(command);

  // Check if the upload was successful
  if (response && response.$metadata.httpStatusCode === 200) {
    return {
      bucket: bucketName,
      key: fileKey,
    };
  } else {
    throw new Error('Failed to upload file to S3');
  }
};

// Get file URL from S3
export const generatePresignedUrl = async (key: string) => {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 60 * 2 }); // 2 minutes
};
