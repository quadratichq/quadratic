import express from 'express';
import checkpointRead from './checkpoint.$fileUuid.GET';
import checkpointPut from './checkpoint.$fileUuid.PUT';
import connectionGet from './connection.GET';
import syncedConnectionLogPost from './synced-connection.$syncedConnectionId.log.POST';
import syncedConnectionGet from './synced-connection.GET';

const router = express.Router();

router.use('/', checkpointRead);
router.use('/', checkpointPut);
router.use('/', connectionGet);
router.use('/', syncedConnectionGet);
router.use('/', syncedConnectionLogPost);

export default router;
