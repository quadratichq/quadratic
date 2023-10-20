import express from 'express';
import getRoute from './get';
import postRoute from './post';
const router = express.Router();

router.use('/', getRoute);
router.use('/', postRoute);

export default router;
