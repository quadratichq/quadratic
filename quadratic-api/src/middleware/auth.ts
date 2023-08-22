import { NextFunction, Response } from 'express';
import { GetVerificationKey, expressjwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import { Request } from 'src/types/Request';

// based on implementation from https://github.com/auth0-developer-hub/api_express_typescript_hello-world/blob/main/src/middleware/auth0.middleware.ts

if (!process.env.AUTH0_JWKS_URI || !process.env.AUTH0_ISSUER) {
  throw new Error('AUTH0_JWKS_URI, or AUTH0_ISSUER need to be defined');
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

export const validateOptionalAccessToken = (req: Request, res: Response, next: NextFunction) => {
  // Check for an Authorization header
  if (req.headers.authorization) {
    // If found, try to authenticate
    validateAccessToken(req, res, (error) => {
      // If there's an authentication error, just remove the user and continue
      if (error) {
        delete req.user;
        const isUnauthorizedError = error.name === 'UnauthorizedError';
        // if there is an error other than a missing token, send an error response
        if (isUnauthorizedError && error.message !== 'No authorization token was found') {
          return res.status(401).send({ message: error.message });
        }
      }
      next();
    });
  } else {
    // If no Authorization header, just continue
    next();
  }
};
