import express from 'express';
import connectionCreate from './connectionCreate';
// import teamRead from './teamRead';
// import teamSharingDelete from './teamSharingUserDelete';
// import teamSharingUpdate from './teamSharingUserInvite';
// import teamUpdate from './teamUpdate';
// import teamsRead from './teamsRead';
const router = express.Router();

router.use('/', connectionCreate);

export default router;
