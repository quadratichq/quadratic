import express, { NextFunction, Response } from 'express';
import { Request } from '../../types/Request';
import { validateAccessToken } from '../../middleware/auth';
import rateLimit from 'express-rate-limit';
import dbClient from '../../dbClient';
import { get_user } from '../../helpers/get_user';
import { get_file } from '../../helpers/get_file';
import { body, validationResult, param } from 'express-validator';
import { File, User } from '@prisma/client';

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

// TODO to support the idea of public/private files
// this needs to be reconfigured roughly as:
// 1. See if file exists
// 2. If it exists, check if it's public
//    A. If it is, return it
//    B. If it's not, check if the current user is the file owner and can access it
//       If they are, return it.
// 3. Return a 404

const validateUUID = () => param('uuid').isUUID(4);
const validateFileContents = () => body('contents').isString();
const validateFileName = () => body('name').optional().isString();
type FILE_PERMISSION = 'OWNER' | 'READONLY' | 'EDIT' | 'NOT_SHARED' | undefined;

const userMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (req.auth?.sub === undefined) {
    return res.status(401).json({ error: { message: 'Invalid authorization token' } });
  }

  req.user = await dbClient.user.upsert({
    where: {
      auth0_id: req.auth.sub,
    },
    update: {},
    create: {
      auth0_id: req.auth.sub,
    },
  });

  next();
};

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

files_router.get('/', validateAccessToken, file_rate_limiter, async (req, res) => {
  const user = await get_user(req);

  // Fetch files owned by the user from the database
  const files = await dbClient.file.findMany({
    where: {
      ownerUserId: user.id,
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
  validateFileName(),
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
      const contents = Buffer.from(req.body.contents, 'base64');
      await dbClient.file.update({
        where: {
          uuid: req.params.uuid,
        },
        data: {
          contents,
          updated_date: new Date(),
          version: 'unknown',
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
          version: 'unknown',
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
  validateFileContents(),
  validateFileName(),
  async (request: Request, response) => {
    // POST creates a new file called "Untitled"
    // You can optionally provide a name and contents in the request body

    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(400).json({ errors: errors.array() });
    }

    const user = await get_user(request);

    // Create a new file in the database
    // use name and contents from request body
    let name = 'Untitled';
    if (request.body.name !== undefined) {
      name = request.body.name;
    }
    const contents = Buffer.from(request.body.contents, 'utf8');

    const file = await dbClient.file.create({
      data: {
        ownerUserId: user.id,
        name: name,
        contents: contents,
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
