import express from 'express';
import teamCreate from './teamCreate';
import teamRead from './teamRead';
import teamSharingDelete from './teamSharingUserDelete';
import teamSharingUpdate from './teamSharingUserInvite';
import teamUpdate from './teamUpdate';
import teamsRead from './teamsRead';
const router = express.Router();

router.use('/', teamsRead);
router.use('/', teamRead);
router.use('/', teamCreate);
router.use('/', teamUpdate);

router.use('/', teamSharingUpdate);
router.use('/', teamSharingDelete);

export default router;
