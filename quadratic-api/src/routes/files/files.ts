import { File, User } from '@prisma/client';
import express, { NextFunction, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import dbClient from '../../dbClient';
import { userMiddleware, userOptionalMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateOptionalAccessToken } from '../../middleware/validateOptionalAccessToken';
import { Request } from '../../types/Request';

type FILE_PERMISSION = 'OWNER' | 'VIEWER' | 'EDITOR';

export const validateUUID = () => param('uuid').isUUID(4);
const validateFileContents = () => body('contents').isString().not().isEmpty();
const validateFileName = () => body('name').isString().not().isEmpty();
const validateFileVersion = () => body('version').isString().not().isEmpty();

const files_router = express.Router();

export const fileMiddleware = async (req: Request, res: Response, next: NextFunction) => {
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

export const getFilePermissions = (user: User | undefined, file: File): FILE_PERMISSION => {
  if (file.ownerUserId === user?.id) {
    return 'OWNER';
  }

  if (file.public_link_access === 'READONLY') {
    return 'VIEWER';
  }

  if (file.public_link_access === 'EDIT') {
    return 'EDITOR';
  }
};

files_router.get('/', validateAccessToken, userMiddleware, async (req: Request, res) => {
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

  return res.status(200).json(files);
});

files_router.get(
  '/:uuid',
  validateUUID(),
  validateOptionalAccessToken,
  userOptionalMiddleware,
  fileMiddleware,
  async (req: Request, res: Response) => {
    if (!req.file) {
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
    if (permissions !== 'EDITOR' && permissions !== 'OWNER') {
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

    return res.status(200).json({ message: 'File updated.' });
  }
);

files_router.delete(
  '/:uuid',
  validateUUID(),
  validateAccessToken,
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

    return res.status(201).json(file); // CREATED
  }
);

export default files_router;
