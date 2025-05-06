import { z } from 'zod';

export const EnvSchema = z.object({
  // Set by vite
  MODE: z.enum(['development', 'production', 'test']),

  // Required
  VITE_QUADRATIC_MULTIPLAYER_URL: z.string(),
  VITE_AUTH0_AUDIENCE: z.string(),
  VITE_AUTH0_ISSUER: z.string(),
  VITE_STORAGE_TYPE: z.enum(['file-system', 's3']), // TODO: are these right?
  VITE_QUADRATIC_API_URL: z.string(),
  VITE_QUADRATIC_CONNECTION_URL: z.string(),
  VITE_VERSION: z.string(),

  // Optional (w/defaults for some)
  VITE_AI_ANALYST_START_NEW_CHAT_MSG_THRESHOLD: z.coerce.number().int().positive().default(20),
  VITE_SENTRY_DSN: z.string().optional(), // Can be set to 'none' to disable when a value is required
  VITE_GOOGLE_ANALYTICS_GTAG: z.string().optional(),
  VITE_AMPLITUDE_ANALYTICS_API_KEY: z.string().optional(),
  VITE_MIXPANEL_ANALYTICS_KEY: z.string().optional(),
  VITE_AUTH_TYPE: z.string().default(''),
  VITE_DEBUG: z.coerce.boolean().default(false),
  VITE_AUTH0_DOMAIN: z.string().default(''),
  VITE_AUTH0_CLIENT_ID: z.string().default(''),
  VITE_ORY_HOST: z.string().optional(),
});

const _parsed = EnvSchema.safeParse(import.meta.env);
if (!_parsed.success) {
  console.error('❌ Invalid environment variables:', _parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const {
  MODE,
  VITE_QUADRATIC_MULTIPLAYER_URL: QUADRATIC_MULTIPLAYER_URL,
  VITE_AI_ANALYST_START_NEW_CHAT_MSG_THRESHOLD: AI_ANALYST_START_NEW_CHAT_MSG_THRESHOLD,
  VITE_QUADRATIC_CONNECTION_URL: QUADRATIC_CONNECTION_URL,
  VITE_QUADRATIC_API_URL: QUADRATIC_API_URL,
  VITE_STORAGE_TYPE: STORAGE_TYPE,
  VITE_SENTRY_DSN: SENTRY_DSN,
  VITE_AUTH_TYPE: AUTH_TYPE,
  VITE_DEBUG: DEBUG,
  VITE_AUTH0_DOMAIN: AUTH0_DOMAIN,
  VITE_AUTH0_CLIENT_ID: AUTH0_CLIENT_ID,
  VITE_AUTH0_AUDIENCE: AUTH0_AUDIENCE,
  VITE_AUTH0_ISSUER: AUTH0_ISSUER,
  VITE_ORY_HOST: ORY_HOST,
  VITE_VERSION: VERSION,
  VITE_GOOGLE_ANALYTICS_GTAG: GOOGLE_ANALYTICS_GTAG,
  VITE_AMPLITUDE_ANALYTICS_API_KEY: AMPLITUDE_ANALYTICS_API_KEY,
  VITE_MIXPANEL_ANALYTICS_KEY: MIXPANEL_ANALYTICS_KEY,
} = _parsed.data;
