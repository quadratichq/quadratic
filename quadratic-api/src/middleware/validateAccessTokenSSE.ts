import type { Request } from 'express';
import type { Params } from 'express-jwt';
import { expressjwt } from 'express-jwt';
import { jwtConfig } from '../auth/providers/auth';

/**
 * Custom token extractor that checks both Authorization header and query parameter.
 * This is needed for SSE (Server-Sent Events) endpoints because EventSource API
 * doesn't support custom headers.
 */
function getTokenFromHeaderOrQuery(req: Request): string | undefined {
  // First try Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Then try query parameter (for EventSource)
  const queryToken = req.query.token;
  if (typeof queryToken === 'string') {
    return queryToken;
  }

  return undefined;
}

// Middleware that validates access tokens from either header or query parameter
export const validateAccessTokenSSE = expressjwt({
  ...jwtConfig(),
  getToken: getTokenFromHeaderOrQuery,
} as Params);
