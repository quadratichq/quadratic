import express from 'express';
import files from './files';
import fileInviteDelete from './files.$uuid.invites.$inviteId.DELETE';
import fileInviteCreate from './files.$uuid.invites.POST';
import fileUserDelete from './files.$uuid.users.$userId.DELETE';
import fileUserEdit from './files.$uuid.users.$userId.PATCH';
const router = express.Router();

router.use('/', files);
router.use('/', fileUserEdit);
router.use('/', fileUserDelete);
router.use('/', fileInviteCreate);
router.use('/', fileInviteDelete);

export default router;
