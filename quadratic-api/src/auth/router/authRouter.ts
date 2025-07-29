import express from 'express';
import authenticateWithCode from '../routes/authenticateWithCode.POST';
import loginWithPassword from '../routes/loginWithPassword.POST';
import signupWithPassword from '../routes/signupWithPassword.POST';
import authenticateRouter from '../routes/user_management.authenticate.POST';
import logoutRouter from '../routes/user_management.sessions.logout.POST';

const authRouter = express.Router();

authRouter.use('/user_management', authenticateRouter);
authRouter.use('/user_management', logoutRouter);
authRouter.use('/auth', loginWithPassword);
authRouter.use('/auth', signupWithPassword);
authRouter.use('/auth', authenticateWithCode);

export default authRouter;
