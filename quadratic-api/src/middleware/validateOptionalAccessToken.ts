import { NextFunction, Response } from 'express';
import { Request } from '../types/Request';
import { validateAccessToken } from './validateAccessToken';

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
