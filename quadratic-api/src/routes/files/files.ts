import { File, User } from '@prisma/client';
import express, { NextFunction, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { body, param, validationResult } from 'express-validator';
import dbClient from '../../dbClient';
import { validateAccessToken } from '../../middleware/auth';
import { userMiddleware } from '../../middleware/user';
import { Request } from '../../types/Request';

const files_router = express.Router();

const file_rate_limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit number of requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req: Request, response) => {
    return req.auth?.sub || 'anonymous';
  },
});

const validateUUID = () => param('uuid').isUUID(4);
const validateFileContents = () => body('contents').isString().not().isEmpty();
const validateFileName = () => body('name').isString().not().isEmpty();
const validateFileVersion = () => body('version').isString().not().isEmpty();
type FILE_PERMISSION = 'OWNER' | 'READONLY' | 'EDIT' | 'NOT_SHARED' | undefined;

const fileMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (req.params.uuid === undefined) {
    return res.status(400).json({ error: { message: 'Invalid file UUID' } });
  }

  const file = await dbClient.file.findUnique({
    where: {
      uuid: req.params.uuid,
    },
  });

  if (file === null) {
    return res.status(404).json({ error: { message: 'File not found' } });
  }

  if (file.deleted) {
    return res.status(400).json({ error: { message: 'File has been deleted' } });
  }

  if (file.ownerUserId !== req?.user?.id) {
    if (file.public_link_access === 'NOT_SHARED') {
      return res.status(403).json({ error: { message: 'Permission denied' } });
    }
  }

  req.file = file;
  next();
};

const getFilePermissions = (user: User, file: File): FILE_PERMISSION => {
  if (file.ownerUserId === user.id) {
    return 'OWNER';
  }

  if (file.public_link_access === 'READONLY') {
    return 'READONLY';
  }

  if (file.public_link_access === 'EDIT') {
    return 'EDIT';
  }

  return 'NOT_SHARED';
};

files_router.get('/', validateAccessToken, file_rate_limiter, userMiddleware, async (req: Request, res) => {
  if (!req.user) {
    return res.status(500).json({ error: { message: 'Internal server error' } });
  }

  // Fetch files owned by the user from the database
  const files = await dbClient.file.findMany({
    where: {
      ownerUserId: req.user.id,
      deleted: false,
    },
    select: {
      uuid: true,
      name: true,
      created_date: true,
      updated_date: true,
      public_link_access: true,
    },
    orderBy: [
      {
        updated_date: 'desc',
      },
    ],
  });

  res.status(200).json(files);
});

files_router.get(
  '/:uuid',
  validateUUID(),
  validateAccessToken,
  file_rate_limiter,
  userMiddleware,
  fileMiddleware,
  async (req: Request, res: Response) => {
    if (!req.file || !req.user) {
      return res.status(500).json({ error: { message: 'Internal server error' } });
    }

    // Validate request parameters
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    return res.status(200).json({
      file: {
        uuid: req.file.uuid,
        name: req.file.name,
        created_date: req.file.created_date,
        updated_date: req.file.updated_date,
        version: req.file.version,
        contents: req.file.contents.toString('utf8'),
      },
      permission: getFilePermissions(req.user, req.file),
    });
  }
);

files_router.post(
  '/:uuid',
  validateUUID(),
  validateAccessToken,
  file_rate_limiter,
  userMiddleware,
  fileMiddleware,
  validateFileContents().optional(),
  validateFileVersion().optional(),
  validateFileName().optional(),
  async (req: Request, res: Response) => {
    if (!req.file || !req.user) {
      return res.status(500).json({ error: { message: 'Internal server error' } });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // ensure the user has EDIT access to the file
    const permissions = getFilePermissions(req.user, req.file);
    if (permissions !== 'EDIT' && permissions !== 'OWNER') {
      return res.status(403).json({ error: { message: 'Permission denied' } });
    }

    // Update the contents
    if (req.body.contents !== undefined) {
      if (req.body.version === undefined) {
        return res.status(400).json({ error: { message: 'Updating `contents` requires `version` in body' } });
      }

      const contents = Buffer.from(req.body.contents, 'utf-8');
      await dbClient.file.update({
        where: {
          uuid: req.params.uuid,
        },
        data: {
          contents,
          updated_date: new Date(),
          version: req.body.version,
          times_updated: {
            increment: 1,
          },
        },
      });
    }

    // update the file name
    if (req.body.name !== undefined) {
      await dbClient.file.update({
        where: {
          uuid: req.params.uuid,
        },
        data: {
          name: req.body.name,
          updated_date: new Date(),
          times_updated: {
            increment: 1,
          },
        },
      });
    }

    res.status(200).json({ message: 'File updated.' });
  }
);

files_router.delete(
  '/:uuid',
  validateUUID(),
  validateAccessToken,
  file_rate_limiter,
  userMiddleware,
  fileMiddleware,
  async (req: Request, res: Response) => {
    // Validate request format
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.file || !req.user) {
      return res.status(500).json({ error: { message: 'Internal server error' } });
    }

    const permissions = getFilePermissions(req.user, req.file);
    if (permissions !== 'OWNER') {
      return res.status(403).json({ error: { message: 'Permission denied' } });
    }

    // Delete the file from the database
    await dbClient.file.update({
      where: {
        uuid: req.params.uuid,
      },
      data: {
        deleted: true,
        deleted_date: new Date(),
      },
    });

    return res.status(200).json({ message: 'File deleted' });
  }
);

files_router.post(
  '/',
  validateAccessToken,
  file_rate_limiter,
  userMiddleware,
  validateFileContents(),
  validateFileVersion(),
  validateFileName(),
  async (req: Request, res) => {
    // POST creates a new file with the provided name, contents, and version

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.user) {
      return res.status(500).json({ error: { message: 'Internal server error' } });
    }

    const contents = Buffer.from(req.body.contents, 'utf8');

    const file = await dbClient.file.create({
      data: {
        ownerUserId: req.user.id,
        name: req.body.name,
        contents: contents,
        version: req.body.version,
      },
      select: {
        uuid: true,
        name: true,
        created_date: true,
        updated_date: true,
      },
    });

    res.status(201).json(file); // CREATED
  }
);

export default files_router;
