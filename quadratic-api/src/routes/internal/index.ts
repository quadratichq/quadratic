import express from 'express';
import checkpointRead from './checkpoint.$fileUuid.GET';
import checkpointPut from './checkpoint.$fileUuid.PUT';
const router = express.Router();

router.use('/', checkpointRead);
router.use('/', checkpointPut);

export default router;
