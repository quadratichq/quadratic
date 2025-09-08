import express from 'express';
import checkpointRead from './checkpoint.$fileUuid.GET';
import checkpointPut from './checkpoint.$fileUuid.PUT';
import lastCheckpointDataUrlGet from './file.$fileUuid.last-checkpoint-data-url.GET';
import scheduledTaskGet from './scheduled_task.GET';

const router = express.Router();

router.use('/', checkpointRead);
router.use('/', checkpointPut);
router.use('/', lastCheckpointDataUrlGet);
router.use('/', scheduledTaskGet);

export default router;
