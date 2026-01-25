import express from 'express';
import checkpointRead from './checkpoint.$fileUuid.GET';
import checkpointPut from './checkpoint.$fileUuid.PUT';
import { default as connectionGet, default as connectionListGet } from './connection.GET';
import initDataGet from './file.$fileUuid.init-data.GET';
import thumbnailPut from './file.$fileUuid.thumbnail.PUT';
import scheduledTaskLogPost from './scheduled-tasks.$scheduledTaskId.log.POST';
import scheduledTaskGet from './scheduled-tasks.GET';
import syncedConnectionLogPost from './synced-connection.$syncedConnectionId.log.POST';
import syncedConnectionGet from './synced-connection.GET';

const router = express.Router();

router.use('/', checkpointRead);
router.use('/', checkpointPut);
router.use('/', connectionGet);
router.use('/', connectionListGet);
router.use('/', initDataGet);
router.use('/', thumbnailPut);
router.use('/', syncedConnectionGet);
router.use('/', syncedConnectionLogPost);
router.use('/', scheduledTaskGet);
router.use('/', scheduledTaskLogPost);

export default router;
