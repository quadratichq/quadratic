import express from 'express';
import checkpointRead from './checkpoint.$fileUuid.GET';
import checkpointPut from './checkpoint.$fileUuid.PUT';
import connectionGet from './connection.GET';
import connectionListGet from './connection.GET';
import initDataGet from './file.$fileUuid.init-data.GET';
import syncedConnectionLogPost from './synced-connection.$syncedConnectionId.log.POST';
import syncedConnectionGet from './synced-connection.GET';
import scheduledTaskLogPost from './scheduled-tasks.$scheduledTaskId.log.POST';
import scheduledTaskGet from './scheduled-tasks.GET';

const router = express.Router();

router.use('/', checkpointRead);
router.use('/', checkpointPut);
router.use('/', connectionGet);
router.use('/', connectionListGet);
router.use('/', initDataGet);
router.use('/', scheduledTaskGet);
router.use('/', scheduledTaskLogPost);
router.use('/', syncedConnectionGet);
router.use('/', syncedConnectionLogPost);

export default router;
