import axios from 'axios';
import type { Request } from 'express';
import multer from 'multer';
import type { Readable } from 'node:stream';
import stream from 'node:stream';
import { QUADRATIC_FILE_URI, QUADRATIC_FILE_URI_PUBLIC } from '../env-vars';
import type { UploadFile } from '../types/Request';
import { encryptFromEnv } from '../utils/crypto';
import logger from '../utils/logger';
import type { UploadFileResponse } from './storage';

const generateUrl = (key: string, isPublic: boolean): string => {
  const baseUrl = isPublic ? QUADRATIC_FILE_URI_PUBLIC : QUADRATIC_FILE_URI;
  return `${baseUrl}/storage/${key}`;
};

const generatePresignedUrl = (key: string): string => generateUrl(`presigned/${key}`, true);

// Get the URL for a given file (key) for the file service.
export const getStorageUrl = (key: string): string => {
  return generateUrl(key, true);
};

// Get a presigned URL for a given file (key) for the file service.
export const getPresignedStorageUrl = (key: string): string => {
  const encrypted = encryptFromEnv(key);
  return generatePresignedUrl(encrypted);
};

// Get a presigned URL for uploading a file to the file service.
export const getPresignedUploadStorageUrl = (key: string): string => {
  const encrypted = encryptFromEnv(key);
  return generateUrl(`upload/${encrypted}`, true);
};

// Upload a file to the file service.
export const upload = async (key: string, contents: string | Uint8Array, jwt: string): Promise<UploadFileResponse> => {
  const url = generateUrl(key, false);

  if (typeof contents === 'string') {
    contents = Uint8Array.from(Buffer.from(contents, 'base64'));
  }

  try {
    const response = await axios
      .post(url, contents, {
        headers: {
          'Content-Type': 'text/plain',
          Authorization: `${jwt}`,
        },
      })
      .then((res) => res.data);

    return response;
  } catch (error) {
    logger.error('Error in upload to file service', error);
    throw new Error(`Failed to upload file to ${url}`);
  }
};

// Collect a full stream and place in a byte array.
function streamToByteArray(stream: Readable): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    stream.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve(Uint8Array.from(buffer));
    });

    stream.on('error', (err: Error) => {
      reject(err);
    });
  });
}

// Multer storage engine for file-system storage.
//
// This middleware is used to handled client upload files and send them to
// the file service.
export const multerFileSystemStorage: multer.Multer = multer({
  storage: {
    _handleFile(
      req: Request,
      file: Express.Multer.File & UploadFile,
      cb: (error?: any, info?: Partial<Express.Multer.File>) => void
    ): void {
      const fileUuid = req.params.uuid;
      const key = `${fileUuid}-${file.originalname}`;
      const jwt = req.header('Authorization');

      file.key = key;

      if (!jwt) {
        cb('No authorization header');
        return;
      }

      // Create a pass-through stream to pipe the file stream to
      const passThrough = new stream.PassThrough();
      file.stream.pipe(passThrough);

      // Collect the stream and upload to the file service
      streamToByteArray(passThrough)
        .then((data) => {
          upload(key, data, jwt)
            .then((_response) => cb(null, file))
            .catch((error) => cb(error));
        })
        .catch((error) => cb(error));
    },

    // only implement if needed (not currently used)
    _removeFile(_req: Request, _file: Express.Multer.File, cb: (error: Error | null) => void): void {
      cb(null);
    },
  },
});
