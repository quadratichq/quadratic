import type { Response } from 'express';
import express from 'express';
import { validationResult } from 'express-validator';
import z from 'zod';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import type { Request } from '../../types/Request';
import { createSyncedConnectionLog } from '../../utils/connections';

const router = express.Router();

const requestValidationMiddleware = validateRequestSchema(
  z.object({
    body: z.object({
      runId: z.string().uuid(),
      syncedDates: z.array(z.string()),
      status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED']),
      error: z.string().nullable().optional(),
    }),
    params: z.object({
      // coerce to a number
      syncedConnectionId: z.coerce.number(),
    }),
  })
);

router.post(
  '/synced-connection/:syncedConnectionId/log',
  validateM2MAuth(),
  requestValidationMiddleware,
  async (req: Request, res: Response) => {
    // Validate request parameters
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const syncedConnectionId = Number(req.params.syncedConnectionId);
    const result = await createSyncedConnectionLog({
      syncedConnectionId,
      runId: req.body.runId,
      syncedDates: req.body.syncedDates,
      status: req.body.status,
      error: req.body.error,
    });

    // Ensure error field is included in response even when undefined
    const response = {
      ...result,
      error: result.error || undefined,
    };

    return res.status(200).json(response);
  }
);

export default router;
