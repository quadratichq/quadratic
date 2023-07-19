import { File, User } from '@prisma/client';

// to make the file a module and avoid the TypeScript error
export {};

declare global {
  declare namespace Express {
    export interface Request {
      user?: User;
      auth?: {
        sub: string;
      };
      file?: File;
    }
  }
}
