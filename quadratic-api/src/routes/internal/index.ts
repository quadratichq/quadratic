import express from 'express';
import checkpointRead from './checkpoint.$fileUuid.GET';
import checkpointPut from './checkpoint.$fileUuid.PUT';
import connectionGet from './connection.$connectionUuid.GET';
import initDataGet from './file.$fileUuid.init-data.GET';
import scheduledTaskGet from './scheduled-tasks.GET';

const router = express.Router();

router.use('/', checkpointRead);
router.use('/', checkpointPut);
router.use('/', connectionGet);
router.use('/', initDataGet);
router.use('/', scheduledTaskGet);

export default router;
