import rateLimit from 'express-rate-limit';
import { RATE_LIMIT_AI_REQUESTS_MAX, RATE_LIMIT_AI_WINDOW_MS } from '../../env-vars';
import type { Request } from '../../types/Request';

export const ai_rate_limiter = rateLimit({
  windowMs: Number(RATE_LIMIT_AI_WINDOW_MS) || 3 * 60 * 60 * 1000, // 3 hours
  max: Number(RATE_LIMIT_AI_REQUESTS_MAX) || 5000, // Limit number of requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (request: Request) => {
    return request.auth?.sub || 'anonymous';
  },
});
