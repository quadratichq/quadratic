import express from 'express';
import teamRead from './teams.$teamUuid.GET';
import teamUpdate from './teams.$teamUuid.POST';
import teamSharingDelete from './teams.$teamUuid.sharing.$userId.DELETE';
import teamSharingUpdate from './teams.$teamUuid.sharing.$userId.POST';
import teamSharingInvite from './teams.$teamUuid.sharing.POST';
import teamsRead from './teams.GET';
import teamCreate from './teams.POST';
const router = express.Router();

router.use('/', teamsRead);
router.use('/', teamRead);
router.use('/', teamCreate);
router.use('/', teamUpdate);

router.use('/', teamSharingInvite);
router.use('/', teamSharingUpdate);
router.use('/', teamSharingDelete);

export default router;
