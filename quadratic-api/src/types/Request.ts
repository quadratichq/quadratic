import { File, Team, User } from '@prisma/client';
import { Request as JWTRequest } from 'express-jwt';
import { Access, UserRoleTeam } from '../../../src/permissions';

// API Request that extends the express-jwt Request type
// middleware is used to these fields
// auth is added by validateAccessToken
// user is added by userMiddleware
// file is added by fileMiddleware
// team is added by teamMiddleware
export interface Request extends JWTRequest {
  auth?: {
    sub: string;
  };
  user?: User;
  file?: File;
}

export type RequestWithAuth = JWTRequest & {
  auth: { sub: string };
};

export type RequestWithUser = {
  user: User;
};

export type RequestWithTeam = {
  team: {
    data: Team;
    user: {
      role: UserRoleTeam;
      access: Access[];
    };
  };
};
