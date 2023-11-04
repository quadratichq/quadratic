import express from 'express';
import connectionCreate from './connectionCreate';
import connectionRun from './connectionRun';
import supportedConnections from './supportedConnections';
// import teamRead from './teamRead';
// import teamSharingDelete from './teamSharingUserDelete';
// import teamSharingUpdate from './teamSharingUserInvite';
// import teamUpdate from './teamUpdate';
// import teamsRead from './teamsRead';
const router = express.Router();

router.use('/', connectionCreate);
router.use('/:uuid/run', connectionRun);
router.use('/supported', supportedConnections);

export default router;
