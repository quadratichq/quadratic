import rateLimit from 'express-rate-limit';
import { RATE_LIMIT_AUTH_REQUESTS_MAX, RATE_LIMIT_AUTH_WINDOW_MS } from '../../env-vars';

// Rate limit username + password sign-ups, magic auth codes, reset password emails and verify emails to 100 per day per ip address
export const auth_rate_limiter = rateLimit({
  windowMs: Number(RATE_LIMIT_AUTH_WINDOW_MS) || 1000 * 60 * 60 * 24, // 24 hours
  max: Number(RATE_LIMIT_AUTH_REQUESTS_MAX) || 100, // Limit number of requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
