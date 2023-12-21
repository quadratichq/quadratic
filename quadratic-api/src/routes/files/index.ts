import express from 'express';
import files from './files';
import fileSharing from './files.$uuid.sharing';
import fileUserCreate from './files.$uuid.users.$userId.PATCH';
const router = express.Router();

router.use('/', files);
router.use('/', fileSharing);
router.use('/', fileUserCreate);

export default router;
