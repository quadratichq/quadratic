const SAMPLE_ENCRYPTION_KEY = 'eb4758047f74bdb2603cce75c4370327ca2c3662c4786867659126da8e64dfcc';

// Optional
export const RATE_LIMIT_AI_WINDOW_MS = process.env.RATE_LIMIT_AI_WINDOW_MS;
export const RATE_LIMIT_AI_REQUESTS_MAX = process.env.RATE_LIMIT_AI_REQUESTS_MAX;
export const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
export const CORS = process.env.CORS || '*';
export const SENTRY_DSN = process.env.SENTRY_DSN;
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = process.env.PORT || 8000;
export const AWS_S3_ENDPOINT = process.env.AWS_S3_ENDPOINT || undefined;
export const ENVIRONMENT = process.env.ENVIRONMENT;
export const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN as string;
export const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID as string;
export const AUTH0_CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET as string;
export const AUTH0_JWKS_URI = process.env.AUTH0_JWKS_URI as string;
export const AUTH0_ISSUER = process.env.AUTH0_ISSUER as string;
export const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE as string;
export const ORY_JWKS_URI = process.env.ORY_JWKS_URI as string;
export const ORY_ADMIN_HOST = process.env.ORY_ADMIN_HOST as string;
export const QUADRATIC_FILE_URI = process.env.QUADRATIC_FILE_URI as string;
export const QUADRATIC_FILE_URI_PUBLIC = process.env.QUADRATIC_FILE_URI_PUBLIC as string;
export const AWS_S3_REGION = process.env.AWS_S3_REGION as string;
export const AWS_S3_ACCESS_KEY_ID = process.env.AWS_S3_ACCESS_KEY_ID as string;
export const AWS_S3_SECRET_ACCESS_KEY = process.env.AWS_S3_SECRET_ACCESS_KEY as string;
export const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME as string;

// Required
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY as string;
export const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY as string;
export const STORAGE_TYPE = process.env.STORAGE_TYPE as string;
export const AUTH_TYPE = process.env.AUTH_TYPE as string;
export const LICENSE_KEY = process.env.LICENSE_KEY as string;
['STRIPE_SECRET_KEY', 'ENCRYPTION_KEY', 'STORAGE_TYPE', 'AUTH_TYPE', 'LICENSE_KEY'].forEach(ensureEnvVarExists);

// Required in prod, optional locally
export const M2M_AUTH_TOKEN = process.env.M2M_AUTH_TOKEN;
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
export const SLACK_FEEDBACK_URL = process.env.SLACK_FEEDBACK_URL;
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

if (NODE_ENV === 'production') {
  ['M2M_AUTH_TOKEN', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'SLACK_FEEDBACK_URL'].forEach(ensureEnvVarExists);
}

// Intentionally hard-coded to avoid this being environment-configurable
// NOTE: Modifying this license check is violating the Quadratic Terms and Conditions and is stealing software, and we will come after you.
export const LICENSE_API_URI = 'https://selfhost.quadratichq.com';

ensureSampleTokenNotUsedInProduction();

function ensureEnvVarExists(key: string) {
  if (NODE_ENV === 'test') return;

  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

function ensureSampleTokenNotUsedInProduction() {
  if (NODE_ENV !== 'production') return;

  if (process.env.ENCRYPTION_KEY === SAMPLE_ENCRYPTION_KEY) {
    throw new Error(
      `Please set a unique ENCRYPTION_KEY in production. Do not use the sample value.  A new key can be generated with: npm run key:generate`
    );
  }
}
