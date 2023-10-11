import { File as DBFile, User as DBUser } from '@prisma/client';
import { Request as JWTRequest } from 'express-jwt';

export interface UploadFile extends Express.Multer.File {
  key: string; // Available using `S3`.
}

// API Request that extends the express-jwt Request type
// middleware is used to these fields
// auth is added by validateAccessToken
// user is added by userMiddleware
// document is added by fileMiddleware
// file is added by the multer middleware
export interface Request extends JWTRequest {
  auth?: {
    sub: string;
  };
  user?: DBUser;
  document?: DBFile;
  file?: UploadFile;
}
