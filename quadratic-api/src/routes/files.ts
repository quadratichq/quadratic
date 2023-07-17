import express from 'express';
import { validateAccessToken } from '../middleware/auth';
import { Request as JWTRequest } from 'express-jwt';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { get_user } from '../helpers/get_user';
import { get_file } from '../helpers/get_file';
import { get_file_metadata } from '../helpers/read_file';

const files_router = express.Router();
const prisma = new PrismaClient();

const file_rate_limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit number of requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (request: JWTRequest, response) => {
    return request.auth?.sub || 'anonymous';
  },
});

const RequestURLSchema = z.string().uuid(); // Validate UUID format

const UpdateFileRequestBody = z.object({
  name: z.string().optional(),
  contents: z.any().optional(),
});

const CreateFileRequestBody = z.object({
  name: z.string().optional(),
  contents: z.any().optional(),
});

files_router.get('/', validateAccessToken, file_rate_limiter, async (request: JWTRequest, response) => {
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

  response.status(200).json(files);
});

files_router.get('/:uuid', validateAccessToken, file_rate_limiter, async (request: JWTRequest, response) => {
  console.time('GET /files/:uuid');

  // Validate request format
  const uuid_result = RequestURLSchema.safeParse(request.params.uuid);
  if (!uuid_result.success) {
    console.log(uuid_result.error.issues);
    return response.status(400).json({ message: 'Invalid file UUID.' });
  }

  // Ensure file exists and user can access it
  const user = await get_user(request);
  const file = await get_file(user, uuid_result.data);
  if (!file) {
    return response.status(404).json({ message: 'File not found.' });
  }

  console.timeEnd('GET /files/:uuid');
  response.status(200).json(file);
});

files_router.post('/:uuid', validateAccessToken, file_rate_limiter, async (request: JWTRequest, response) => {
  console.time('UpdateFile');

  const uuid_result = RequestURLSchema.safeParse(request.params.uuid);
  if (!uuid_result.success) {
    console.log(uuid_result.error.issues);
    return response.status(400).json({ message: 'Invalid file UUID.' });
  }
  const r_json = UpdateFileRequestBody.parse(request.body);

  console.time('db-get');
  const user = await get_user(request);
  const file = await get_file(user, uuid_result.data);
  if (file?.uuid !== request.params.uuid) {
    return response.status(400).json({ message: 'URL UUID does not match file UUID.' });
  }
  console.timeEnd('db-get');

  if (!file) {
    return response.status(404).json({ message: 'File not found.' });
  }

  console.time('db-write');
  const file_contents = JSON.parse(r_json.contents);
  const file_metadata = get_file_metadata(file_contents);
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

  console.timeEnd('db-write');

  console.timeEnd('UpdateFile');
  response.status(200).json({ message: 'File backup successful.' });
});

files_router.delete('/:uuid', validateAccessToken, file_rate_limiter, async (request: JWTRequest, response) => {
  // Validate request format
  const schema = z.string().uuid();
  const result = schema.safeParse(request.params.uuid);
  if (!result.success) {
    console.log(result.error.issues);
    return response.status(400).json({ message: 'Invalid file UUID.' });
  }

  // Ensure file exists and user can access it
  const user = await get_user(request);
  const file = await get_file(user, result.data);
  if (!file) {
    return response.status(404).json({ message: 'File not found.' });
  }

  // Delete file from database
  await prisma.qFile.delete({
    where: {
      id: file.id,
    },
  });

  response.status(200);
});

files_router.post('/', validateAccessToken, file_rate_limiter, async (request: JWTRequest, response) => {
  // POST creates a new file called "Untitled"
  // You can optionally provide a name and contents in the request body
  const request_json = CreateFileRequestBody.parse(request.body);
  const user = await get_user(request);

  // Create a new file in the database
  // use name and contents from request body if provided
  const file = await prisma.qFile.create({
    data: {
      qUserId: user.id,
      name: request_json.name ?? 'Untitled',
      contents: request_json.name ?? {},
    },
    select: {
      uuid: true,
      name: true,
      created_date: true,
      updated_date: true,
    },
  });

  response.status(201).json(file); // CREATED
});

export default files_router;
