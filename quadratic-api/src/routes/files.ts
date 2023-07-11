import express from 'express';
import { validateAccessToken } from '../middleware/auth';
import { Request as JWTRequest } from 'express-jwt';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { PrismaClient, QFile, QUser } from '@prisma/client';
import { get_user } from '../helpers/get_user';
import { get_file } from '../helpers/get_file';
import { get_file_metadata } from '../helpers/read_file';

const files_router = express.Router();
const prisma = new PrismaClient();

const ai_rate_limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit number of requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (request: JWTRequest, response) => {
    return request.auth?.sub || 'anonymous';
  },
});

const FilesBackupRequestBody = z.object({
  uuid: z.string(),
  fileContents: z.any(),
});

files_router.post('/:uuid', validateAccessToken, ai_rate_limiter, async (request: JWTRequest, response) => {
  console.log('here1');
  console.time('backup');

  const r_json = FilesBackupRequestBody.parse(request.body);

  console.time('db-get');
  const user = await get_user(request);
  const file = await get_file(user, r_json.uuid);
  if (file?.uuid !== request.params.uuid) {
    return response.status(400).json({ message: 'URL UUID does not match file UUID.' });
  }
  console.timeEnd('db-get');

  console.time('db-write');
  const file_contents = JSON.parse(r_json.fileContents);
  const file_metadata = get_file_metadata(file_contents);

  if (file) {
    await prisma.qFile.update({
      where: {
        id: file.id,
      },
      data: {
        name: file_metadata.name,
        contents: file_contents,
        updated_date: new Date(file_metadata.modified),
        version: file_metadata.version,
        times_updated: {
          increment: 1,
        },
      },
    });
  } else {
    await prisma.qFile.create({
      data: {
        qUserId: user.id,
        uuid: r_json.uuid,
        name: file_metadata.name,
        contents: file_contents,
        created_date: new Date(file_metadata.created),
        updated_date: new Date(file_metadata.modified),
        version: file_metadata.version,
      },
    });
  }
  console.timeEnd('db-write');

  console.timeEnd('backup');
  response.status(200).json({ message: 'File backup successful.' });
});

files_router.get('/:uuid', validateAccessToken, ai_rate_limiter, async (request: JWTRequest, response) => {
  console.time('read');
  const r_json = FilesBackupRequestBody.parse(request.body);
  const user = await get_user(request);
  const file = await get_file(user, r_json.uuid);
  if (file?.uuid !== request.params.uuid) {
    return response.status(400).json({ message: 'URL UUID does not match file UUID.' });
  }

  if (!file) {
    return response.status(404).json({ message: 'File not found.' });
  }

  console.timeEnd('read');
  response.status(200).json(file);
});

files_router.get('/', validateAccessToken, ai_rate_limiter, async (request: JWTRequest, response) => {
  console.time('listFiles');

  // Ensure the user ID in the params matches the authenticated user ID from the token
  const user = await get_user(request);

  // Fetch files owned by the user from the database
  const files = await prisma.qFile.findMany({
    where: {
      qUserId: user.id,
    },
    select: {
      uuid: true,
      name: true,
      created_date: true,
      updated_date: true,
    },
  });

  console.timeEnd('listFiles');
  response.status(200).json(files);
});

export default files_router;
