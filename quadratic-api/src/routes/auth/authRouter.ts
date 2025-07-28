import express from 'express';
import authenticateWithCode from './authenticateWithCode.POST';
import loginWithPassword from './loginWithPassword.POST';
import signupWithPassword from './signupWithPassword.POST';
import authenticateRouter from './user_management.authenticate.POST';

const authRouter = express.Router();

authRouter.use('/', authenticateRouter);
authRouter.use('/auth', loginWithPassword);
authRouter.use('/auth', signupWithPassword);
authRouter.use('/auth', authenticateWithCode);

export default authRouter;
