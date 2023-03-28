import { expressjwt, GetVerificationKey } from 'express-jwt';
import jwksRsa from 'jwks-rsa';

// based on implementation from https://github.com/auth0-developer-hub/api_express_typescript_hello-world/blob/main/src/middleware/auth0.middleware.ts

if (!process.env.AUTH0_JWKS_URI || !process.env.AUTH0_AUDIENCE || !process.env.AUTH0_ISSUER) {
  throw new Error('AUTH0_JWKS_URI, AUTH0_AUDIENCE, or AUTH0_ISSUER are not defined');
}

export const validateAccessToken = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: process.env.AUTH0_JWKS_URI,
  }) as GetVerificationKey,
  audience: process.env.AUTH0_AUDIENCE,
  issuer: process.env.AUTH0_ISSUER,
  algorithms: ['RS256'],
});
