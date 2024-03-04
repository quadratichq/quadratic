import { GetVerificationKey, expressjwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import { AUTH0_AUDIENCE, AUTH0_ISSUER, AUTH0_JWKS_URI } from '../env-vars';

// based on implementation from https://github.com/auth0-developer-hub/api_express_typescript_hello-world/blob/main/src/middleware/auth0.middleware.ts
export const validateAccessToken = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: AUTH0_JWKS_URI,
  }) as GetVerificationKey,
  audience: AUTH0_AUDIENCE,
  issuer: AUTH0_ISSUER,
  algorithms: ['RS256'],
});
