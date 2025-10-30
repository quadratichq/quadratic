import express from 'express';
import authenticateWithCode from '../routes/authenticate-with-code.POST';
import loginWithPassword from '../routes/login-with-password.POST';
import resetPassword from '../routes/reset-password.POST';
import sendResetPassword from '../routes/send-reset-password.POST';
import signupWithPassword from '../routes/signup-with-password.POST';
import authenticate from '../routes/user_management.authenticate.POST';
import logout from '../routes/user_management.sessions.logout.POST';
import verifyEmail from '../routes/verify-email.POST';

const authRouter = express.Router();

authRouter.use('/user_management/authenticate', authenticate);
authRouter.use('/user_management/sessions/logout', logout);
authRouter.use('/v0/auth/login-with-password', loginWithPassword);
authRouter.use('/v0/auth/signup-with-password', signupWithPassword);
authRouter.use('/v0/auth/authenticate-with-code', authenticateWithCode);
authRouter.use('/v0/auth/verify-email', verifyEmail);
authRouter.use('/v0/auth/send-reset-password', sendResetPassword);
authRouter.use('/v0/auth/reset-password', resetPassword);

export default authRouter;
