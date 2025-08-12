import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import { AUTH_CORS } from '../../env-vars';
import authenticateWithCode from '../routes/authenticate-with-code.POST';
import authenticateWithMagicCode from '../routes/authenticate-with-magic-code.POST';
import loginWithPassword from '../routes/login-with-password.POST';
import resetPassword from '../routes/reset-password.POST';
import sendMagicAuthCode from '../routes/send-magic-auth-code.POST';
import sendResetPassword from '../routes/send-reset-password.POST';
import signupWithPassword from '../routes/signup-with-password.POST';
import authenticate from '../routes/user_management.authenticate.POST';
import logout from '../routes/user_management.sessions.logout.POST';
import verifyEmail from '../routes/verify-email.POST';

const authRouter = express.Router();

const checkClientHostname = (req: Request, res: Response, next: NextFunction) => {
  const clientHostname = new URL(AUTH_CORS).hostname;
  if (req.hostname !== clientHostname) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

authRouter.use('/user_management/authenticate', checkClientHostname, authenticate);
authRouter.use('/user_management/sessions/logout', checkClientHostname, logout);
authRouter.use('/v0/auth/login-with-password', checkClientHostname, loginWithPassword);
authRouter.use('/v0/auth/signup-with-password', checkClientHostname, signupWithPassword);
authRouter.use('/v0/auth/authenticate-with-code', checkClientHostname, authenticateWithCode);
authRouter.use('/v0/auth/verify-email', checkClientHostname, verifyEmail);
authRouter.use('/v0/auth/send-reset-password', checkClientHostname, sendResetPassword);
authRouter.use('/v0/auth/reset-password', checkClientHostname, resetPassword);
authRouter.use('/v0/auth/send-magic-auth-code', checkClientHostname, sendMagicAuthCode);
authRouter.use('/v0/auth/authenticate-with-magic-code', checkClientHostname, authenticateWithMagicCode);

export default authRouter;
