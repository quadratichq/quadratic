import express from 'express';
import authenticateWithCode from '../routes/authenticateWithCode.POST';
import authenticateWithMagicCode from '../routes/authenticateWithMagicCode.POST';
import loginWithPassword from '../routes/loginWithPassword.POST';
import resetPassword from '../routes/resetPassword.POST';
import sendMagicAuthCode from '../routes/sendMagicAuthCode.POST';
import sendResetPassword from '../routes/sendResetPassword.POST';
import signupWithPassword from '../routes/signupWithPassword.POST';
import authenticateRouter from '../routes/user_management.authenticate.POST';
import logoutRouter from '../routes/user_management.sessions.logout.POST';
import verifyEmail from '../routes/verifyEmail.POST';

const authRouter = express.Router();

authRouter.use('/user_management', authenticateRouter);
authRouter.use('/user_management', logoutRouter);
authRouter.use('/auth', loginWithPassword);
authRouter.use('/auth', signupWithPassword);
authRouter.use('/auth', authenticateWithCode);
authRouter.use('/auth', verifyEmail);
authRouter.use('/auth', sendResetPassword);
authRouter.use('/auth', resetPassword);
authRouter.use('/auth', sendMagicAuthCode);
authRouter.use('/auth', authenticateWithMagicCode);

export default authRouter;
