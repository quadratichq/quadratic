import type { Response } from 'express';
import express from 'express';
import { validationResult } from 'express-validator';
import dbClient from '../../dbClient';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import type { Request } from '../../types/Request';

const router = express.Router();

router.get('/scheduled-tasks', validateM2MAuth(), async (req: Request, res: Response) => {
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
      file: {
        select: {
          uuid: true,
        },
      },
      uuid: true,
      nextRunTime: true,
      operations: true,
    },
  });

  // Transform operations from Buffer to parsed JSON for consistency with other endpoints
  const transformedTasks = scheduledTasks.map((task) => ({
    fileId: task.file.uuid,
    taskId: task.uuid,
    nextRunTime: task.nextRunTime,
    operations: Array.from(new Uint8Array(task.operations)),
  }));

  return res.status(200).json(transformedTasks);
});

export default router;
