import type { File, User } from '@prisma/client';
import type { Request as JWTRequest } from 'express-jwt';

export interface UploadFile extends Express.Multer.File {
  key?: string; // Available using `S3`.
}

export interface Auth {
  sub: string;
  email: string;
}

// API Request that extends the express-jwt Request type
// middleware is used to these fields
// auth is added by validateAccessToken
// user is added by userMiddleware
// document is added by fileMiddleware
// file is added by the multer middleware
export interface Request extends JWTRequest {
  auth?: Auth;
  user?: User;
  quadraticFile?: File;
  file?: UploadFile;
}

export type RequestWithFile = Request & {
  file: UploadFile;
};

export type RequestWithOptionalAuth = JWTRequest & {
  auth?: Auth;
};

export type RequestWithAuth = JWTRequest & {
  auth: Auth;
};

export type RequestWithUser = RequestWithAuth & {
  user: User;
  userCreated: boolean;
};

export type RequestWithOptionalUser = RequestWithOptionalAuth & {
  user?: User;
};

export type RequestWithQuadraticFile = RequestWithOptionalUser & {
  quadraticFile: File;
};
