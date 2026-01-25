import type { Response } from 'express';
import express from 'express';
import { body, param, validationResult } from 'express-validator';
import dbClient from '../../dbClient';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import type { Request } from '../../types/Request';

const router = express.Router();

router.put(
  '/file/:uuid/thumbnail',
  validateM2MAuth(),
  param('uuid').isUUID(4),
  body('thumbnailKey').isString().notEmpty(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      params: { uuid: fileUuid },
      body: { thumbnailKey },
    } = req;

    await dbClient.file.update({
      where: {
        uuid: fileUuid,
      },
      data: {
        thumbnail: thumbnailKey,
        updatedDate: new Date(),
      },
    });

    return res.status(200).json({ success: true });
  }
);

export default router;
