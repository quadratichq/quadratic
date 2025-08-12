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

const checkClientOrigin = (req: Request, res: Response, next: NextFunction) => {
  const clientOrigin = new URL(AUTH_CORS).origin;
  if (req.headers.origin !== clientOrigin) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

authRouter.use('/user_management/authenticate', checkClientOrigin, authenticate);
authRouter.use('/user_management/sessions/logout', checkClientOrigin, logout);
authRouter.use('/v0/auth/login-with-password', checkClientOrigin, loginWithPassword);
authRouter.use('/v0/auth/signup-with-password', checkClientOrigin, signupWithPassword);
authRouter.use('/v0/auth/authenticate-with-code', checkClientOrigin, authenticateWithCode);
authRouter.use('/v0/auth/verify-email', checkClientOrigin, verifyEmail);
authRouter.use('/v0/auth/send-reset-password', checkClientOrigin, sendResetPassword);
authRouter.use('/v0/auth/reset-password', checkClientOrigin, resetPassword);
authRouter.use('/v0/auth/send-magic-auth-code', checkClientOrigin, sendMagicAuthCode);
authRouter.use('/v0/auth/authenticate-with-magic-code', checkClientOrigin, authenticateWithMagicCode);

export default authRouter;
