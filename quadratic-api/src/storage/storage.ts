import type multer from 'multer';
import { STORAGE_TYPE } from '../env-vars';
import { getPresignedStorageUrl, getPresignedUploadStorageUrl, multerFileSystemStorage, upload } from './fileSystem';
import { generatePresignedUrl, generatePresignedUploadUrl, multerS3Storage, S3Bucket, uploadStringAsFileS3 } from './s3';

export type UploadFileResponse = {
  bucket: string;
  key: string;
};

// Get the URL for a given file (key).
export const getFileUrl = async (key: string) => {
  switch (STORAGE_TYPE) {
    case 's3':
      return await generatePresignedUrl(key, S3Bucket.FILES);
    case 'file-system':
      return getPresignedStorageUrl(key);
    default:
      throw new Error(`Unsupported storage type in getFileUrl(): ${STORAGE_TYPE}`);
  }
};

// Get a presigned URL for a given file (key).
export const getPresignedFileUrl = async (key: string) => {
  switch (STORAGE_TYPE) {
    case 's3':
      return await generatePresignedUrl(key, S3Bucket.FILES);
    case 'file-system':
      return getPresignedStorageUrl(key);
    default:
      throw new Error(`Unsupported storage type in getPresignedFileUrl(): ${STORAGE_TYPE}`);
  }
};

// Get a presigned URL for uploading a file (key).
export const getPresignedFileUploadUrl = async (key: string, contentType: string = 'application/octet-stream') => {
  switch (STORAGE_TYPE) {
    case 's3':
      return await generatePresignedUploadUrl(key, S3Bucket.FILES, contentType);
    case 'file-system':
      return getPresignedUploadStorageUrl(key);
    default:
      throw new Error(`Unsupported storage type in getPresignedFileUploadUrl(): ${STORAGE_TYPE}`);
  }
};

// Upload a file (key).
export const uploadFile = async (
  key: string,
  contents: string,
  jwt: string,
  bucket: S3Bucket
): Promise<UploadFileResponse> => {
  switch (STORAGE_TYPE) {
    case 's3':
      return await uploadStringAsFileS3(key, contents, bucket);
    case 'file-system':
      return await upload(key, contents, jwt);
    default:
      throw new Error(`Unsupported storage type in uploadFile(): ${STORAGE_TYPE}`);
  }
};

// Multer middleware for file uploads.
export const uploadMiddleware = (bucket: S3Bucket): multer.Multer => {
  switch (STORAGE_TYPE) {
    case 's3':
      return multerS3Storage(bucket);
    case 'file-system':
      return multerFileSystemStorage as unknown as multer.Multer;
    default:
      throw new Error(`Unsupported storage type in uploadMiddleware(): ${STORAGE_TYPE}`);
  }
};
