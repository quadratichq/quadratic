import type { Response } from 'express';
import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { generateMemories } from '../../ai/memory/memoryService';
import dbClient from '../../dbClient';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import type { Request } from '../../types/Request';

const router = express.Router();

router.post(
  '/file/:uuid/ai-memory',
  validateM2MAuth(),
  param('uuid').isUUID(4),
  body('payload').isObject(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      params: { uuid: fileUuid },
      body: { payload },
    } = req;

    try {
      const file = await dbClient.file.findUnique({
        where: { uuid: fileUuid },
        select: { id: true, name: true, ownerTeamId: true },
      });

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Run generation in the background
      generateMemories({
        teamId: file.ownerTeamId,
        fileId: file.id,
        fileName: file.name,
        payload,
      }).catch((err) => {
        console.error('[ai-memory] Failed to generate memories from cloud worker:', err);
      });

      return res.status(202).json({ success: true });
    } catch (error) {
      console.error('[ai-memory] Error processing memory payload:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
