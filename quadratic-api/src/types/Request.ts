import { File, User } from '@prisma/client';
import { Request as FTWRequest } from 'express-jwt';

// API Request that extends the express-jwt Request type
export interface Request extends FTWRequest {
  user?: User;
  auth?: {
    sub: string;
  };
  file?: File;
}
