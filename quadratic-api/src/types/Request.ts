import { File, User } from '@prisma/client';
import { Request as JWTRequest } from 'express-jwt';

// API Request that extends the express-jwt Request type
// middleware is used to these fields
// auth is added by validateAccessToken
// user is added by userMiddleware
// file is added by fileMiddleware
export interface Request extends JWTRequest {
  auth?: {
    sub: string;
  };
  user?: User;
  file?: File;
}
