import express from 'express';
import { authCallback } from '../routes/authCallback.GET';
import { authLogin } from '../routes/login.GET';
import { authLogout } from '../routes/logout.GET';

const authRouter = express.Router();

authRouter.use('/login', authLogin);
authRouter.use('/logout', authLogout);
authRouter.use('/callback', authCallback);

export default authRouter;
