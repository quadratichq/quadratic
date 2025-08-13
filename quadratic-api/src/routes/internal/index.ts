import express from 'express';
import checkpointRead from './checkpoint.$fileUuid.GET';
import checkpointPut from './checkpoint.$fileUuid.PUT';
import userEmailMigration from './user-email-migration.$take.GET';

const router = express.Router();

router.use('/', checkpointRead);
router.use('/', checkpointPut);
router.use('/', userEmailMigration);

export default router;
