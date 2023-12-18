import express from 'express';
import teamGet from './teams.$teamUuid.GET';
import teamUpdate from './teams.$teamUuid.POST';
import teamInviteDelete from './teams.$teamUuid.invites.$inviteId.DELETE';
import teamInviteCreate from './teams.$teamUuid.invites.POST';
import teamUserDelete from './teams.$teamUuid.users.$userId.DELETE';
import teamUserUpdate from './teams.$teamUuid.users.$userId.POST';
import teamsGet from './teams.GET';
import teamCreate from './teams.POST';
const router = express.Router();

router.use('/', teamsGet);
router.use('/', teamGet);
router.use('/', teamCreate);
router.use('/', teamUpdate);

router.use('/', teamInviteCreate);
router.use('/', teamInviteDelete);
router.use('/', teamUserUpdate);
router.use('/', teamUserDelete);

export default router;
