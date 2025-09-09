import type { Params } from 'express-jwt';
import { expressjwt } from 'express-jwt';
import { jwtConfig } from '../auth/providers/auth';

// based on implementation from https://github.com/auth0-developer-hub/api_express_typescript_hello-world/blob/main/src/middleware/auth0.middleware.ts
export const validateAccessToken = expressjwt(jwtConfig() as Params);
