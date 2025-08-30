import type { Response } from 'express';
import express from 'express';
import { validationResult } from 'express-validator';
import dbClient from '../../dbClient';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import type { Request } from '../../types/Request';

const router = express.Router();

router.get('/scheduled_task', validateM2MAuth(), async (req: Request, res: Response) => {
  // Validate request parameters
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const currentTime = new Date();
  const scheduledTasks = await dbClient.scheduledTask.findMany({
    where: {
      status: 'ACTIVE',
      nextRunTime: {
        lte: currentTime,
      },
    },
    select: {
      id: true,
      nextRunTime: true,
      operations: true,
    },
  });

  // Transform operations from Buffer to parsed JSON for consistency with other endpoints
  const transformedTasks = scheduledTasks.map((task) => ({
    id: task.id,
    nextRunTime: task.nextRunTime,
    operations: task.operations ? JSON.parse(task.operations.toString()) : null,
  }));

  return res.status(200).json(transformedTasks);
});

export default router;
