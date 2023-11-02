import express from 'express';
import teamCreate from './teamCreate';
import teamRead from './teamRead';
import teamSharingDelete from './teamSharingUserDelete';
import teamSharingInvite from './teamSharingUserInvite';
import teamSharingUpdate from './teamSharingUserUpdate';
import teamUpdate from './teamUpdate';
import teamsRead from './teamsRead';
const router = express.Router();

router.use('/', teamsRead);
router.use('/', teamRead);
router.use('/', teamCreate);
router.use('/', teamUpdate);

router.use('/', teamSharingInvite);
router.use('/', teamSharingUpdate);
router.use('/', teamSharingDelete);

export default router;
