import { LinkPermission } from '@prisma/client';
import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { getUserProfile } from '../../auth0/profile';
import dbClient from '../../dbClient';
import { userMiddleware, userOptionalMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateOptionalAccessToken } from '../../middleware/validateOptionalAccessToken';
import { Request } from '../../types/Request';
import { fileMiddleware } from './fileMiddleware';
import { validateUUID } from './files';
import { getFilePermissions } from './getFilePermissions';

const validateFileSharingPermission = () =>
  body('public_link_access').isIn([LinkPermission.READONLY, LinkPermission.NOT_SHARED]);

const sharing_router = express.Router();

sharing_router.get(
  '/:uuid/sharing',
  validateUUID(),
  validateOptionalAccessToken,
  userOptionalMiddleware,
  fileMiddleware,
  async (req: Request, res: Response) => {
    if (!req.document) {
      return res.status(500).json({ error: { message: 'Internal server error' } });
    }

    // Validate request parameters
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Only authenticated users can view the email addresses of other users
    let owner = await getUserProfile(req.document.ownerUserId);
    if (!req.user) {
      owner.email = null;
    }

    return res.status(200).json({
      owner: owner,
      public_link_access: req.document.public_link_access,
      // users: [],
      // teams: [],
    });
  }
);

sharing_router.post(
  '/:uuid/sharing',
  validateUUID(),
  validateAccessToken,
  userMiddleware,
  fileMiddleware,
  validateFileSharingPermission().optional(),
  async (req: Request, res: Response) => {
    if (!req.document || !req.user) {
      return res.status(500).json({ error: { message: 'Internal server error' } });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // update the link sharing permissions
    if (req.body.public_link_access !== undefined) {
      // only the OWNER of the file can modify the link sharing permissions
      const permissions = getFilePermissions(req.user, req.document);
      if (permissions !== 'OWNER') {
        return res.status(403).json({ error: { message: 'Permission denied' } });
      }
      await dbClient.file.update({
        where: { uuid: req.params.uuid },
        data: { public_link_access: req.body.public_link_access },
      });
    }

    return res.status(200).json({ message: 'File updated.' });
  }
);

export default sharing_router;
