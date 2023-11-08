import express from 'express';
import connectionCreate from './connectionCreate';
import connectionList from './connectionList';
import connectionRun from './connectionRun';
import supportedConnections from './supportedConnections';

const router = express.Router();

router.use('/', connectionList);
router.use('/', connectionCreate);
router.use('/', connectionRun);
router.use('/', supportedConnections);

export default router;
