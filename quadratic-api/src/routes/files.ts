import express, { Response } from 'express';
import { validateAccessToken } from '../middleware/auth';
import { Request as JWTRequest } from 'express-jwt';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import dbClient from '../dbClient';
import { get_user } from '../helpers/get_user';
import { get_file } from '../helpers/get_file';
import { get_file_metadata } from '../helpers/read_file';
import { body, validationResult, param } from 'express-validator';

const files_router = express.Router();

const file_rate_limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit number of requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (request: JWTRequest, response) => {
    return request.auth?.sub || 'anonymous';
  },
});

// TODO to support the idea of public/private files
// this needs to be reconfigured roughly as:
// 1. See if file exists
// 2. If it exists, check if it's public
//    A. If it is, return it
//    B. If it's not, check if the current user is the file owner and can access it
//       If they are, return it.
// 3. Return a 404

const validateUUID = () => param('uuid').isUUID(4);
const validateFileContents = () => body('contents').optional().isJSON();
const validateFileName = () => body('name').optional().isString();

files_router.get('/', validateAccessToken, file_rate_limiter, async (request: JWTRequest, response) => {
  const user = await get_user(request);

  // Fetch files owned by the user from the database
  const files = await dbClient.qFile.findMany({
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

files_router.get(
  '/:uuid',
  validateUUID(),
  validateAccessToken,
  file_rate_limiter,
  async (request: JWTRequest, response: Response) => {
    // Validate request parameters
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(400).json({ errors: errors.array() });
    }

    // Ensure file exists and user can access it
    const user = await get_user(request);
    const file_result = await get_file(user, request.params.uuid);
    if (!file_result.permission) {
      return response.status(403).json({ message: 'Permission denied.' });
    }
    if (!file_result.file) {
      return response.status(404).json({ message: 'File not found.' });
    }

    response.status(200).json(file_result.file);
  }
);

files_router.post(
  '/:uuid',
  validateUUID(),
  validateAccessToken,
  file_rate_limiter,
  validateFileContents(),
  validateFileName(),
  async (request: JWTRequest, response: Response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(400).json({ errors: errors.array() });
    }

    // Ensure file exists and user can access it
    const user = await get_user(request);
    const file_result = await get_file(user, request.params.uuid);
    if (!file_result.permission) {
      return response.status(403).json({ message: 'Permission denied.' });
    }
    if (!file_result.file) {
      return response.status(404).json({ message: 'File not found.' });
    }

    const file_contents = JSON.parse(request.body.contents);
    const file_metadata = get_file_metadata(file_contents);
    await dbClient.qFile.update({
      where: {
        id: file_result.file.id,
      },
      data: {
        name: request.body.name,
        contents: file_contents,
        updated_date: new Date(file_metadata.modified),
        version: file_metadata.version,
        times_updated: {
          increment: 1,
        },
      },
    });

    response.status(200).json({ message: 'File updated.' });
  }
);

files_router.delete(
  '/:uuid',
  validateUUID(),
  validateAccessToken,
  file_rate_limiter,
  async (request: JWTRequest, response: Response) => {
    // Validate request format
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(400).json({ errors: errors.array() });
    }

    // Ensure file exists and user can access it
    const user = await get_user(request);
    const file_result = await get_file(user, request.params.uuid);
    if (!file_result.permission) {
      return response.status(403).json({ message: 'Permission denied.' });
    }
    if (!file_result.file) {
      return response.status(404).json({ message: 'File not found.' });
    }

    // raise error not implemented
    throw new Error('Need to check if the user has permission to delete the file.');

    // Delete file from database
    // await dbClient.qFile.delete({
    //   where: {
    //     id: file_result.file.id,
    //   },
    // });

    // response.status(200);
  }
);

files_router.post(
  '/',
  validateAccessToken,
  file_rate_limiter,
  validateFileContents(),
  validateFileName(),
  async (request: JWTRequest, response) => {
    // POST creates a new file called "Untitled"
    // You can optionally provide a name and contents in the request body

    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(400).json({ errors: errors.array() });
    }

    const user = await get_user(request);

    // Create a new file in the database
    // use name and contents from request body if provided
    const file = await dbClient.qFile.create({
      data: {
        qUserId: user.id,
        name: request.body.name ?? 'Untitled',
        contents: request.body.contents ?? {},
      },
      select: {
        uuid: true,
        name: true,
        created_date: true,
        updated_date: true,
      },
    });

    response.status(201).json(file); // CREATED
  }
);

export default files_router;
