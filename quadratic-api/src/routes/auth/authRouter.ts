import express from 'express';
import authenticateWithCode from './authenticateWithCode.POST';
import loginWithPassword from './loginWithPassword.POST';
import signupWithPassword from './signupWithPassword.POST';
import authenticateRouter from './user_management.authenticate.POST';
import logoutRouter from './user_management.sessions.logout.POST';

const authRouter = express.Router();

authRouter.use('/user_management', authenticateRouter);
authRouter.use('/user_management', logoutRouter);
authRouter.use('/auth', loginWithPassword);
authRouter.use('/auth', signupWithPassword);
authRouter.use('/auth', authenticateWithCode);

export default authRouter;
