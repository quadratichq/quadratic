import { Request } from 'express';
import multer from 'multer';
import stream, { Readable } from 'node:stream';
import { QUADRATIC_FILE_URI } from '../env-vars';
import { encryptFromEnv } from '../utils/crypto';
import { UploadFileResponse } from './storage';

const generateUrl = (key: string): string => `${QUADRATIC_FILE_URI}/storage/${key}`;
const generatePresignedUrl = (key: string): string => generateUrl(`presigned/${key}`);

export const getStorageUrl = (key: string): string => {
  return generateUrl(key);
};

export const getPresignedStorageUrl = (key: string): string => {
  const encrypted = encryptFromEnv(key);
  return generatePresignedUrl(encrypted);
};

export const upload = async (key: string, contents: string | Uint8Array, jwt: string): Promise<UploadFileResponse> => {
  const url = generateUrl(key);

  console.warn('Uploading to', url);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: contents,
      headers: {
        'Content-Type': 'text/plain',
        Authorization: `${jwt}`,
      },
    }).then((res) => res.json());

    return response;
  } catch (e) {
    console.error(e);
    throw new Error(`Failed to upload file to ${url}`);
  }
};

function streamToByteArray(stream: Readable): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    stream.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve(new Uint8Array(buffer));
    });

    stream.on('error', (err: Error) => {
      reject(err);
    });
  });
}

export const multerFileSystemStorage: multer.Multer = multer({
  storage: {
    _handleFile(
      req: Request,
      file: Express.Multer.File,
      cb: (error?: any, info?: Partial<Express.Multer.File>) => void
    ): void {
      const fileUuid = req.params.uuid;
      const key = `${fileUuid}-${file.originalname}`;
      const jwt = req.header('Authorization');

      if (!jwt) {
        cb('No authorization header');
        return;
      }

      const passThrough = new stream.PassThrough();
      file.stream.pipe(passThrough);

      streamToByteArray(passThrough)
        .then((data) => {
          upload(key, data, jwt)
            .then((_response) => cb(null, file))
            .catch((error) => cb(error));
        })
        .catch((error) => cb(error));
    },

    _removeFile(_req: Request, _file: Express.Multer.File, cb: (error: Error | null) => void): void {
      cb(null);
    },
  },
});
