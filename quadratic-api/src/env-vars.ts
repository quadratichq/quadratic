const SAMPLE_ENCRYPTION_KEY = 'eb4758047f74bdb2603cce75c4370327ca2c3662c4786867659126da8e64dfcc';

// Optional
export const DEBUG = process.env.DEBUG;
export const VERSION = process.env.VERSION;
export const RATE_LIMIT_AI_WINDOW_MS = process.env.RATE_LIMIT_AI_WINDOW_MS;
export const RATE_LIMIT_AI_REQUESTS_MAX = process.env.RATE_LIMIT_AI_REQUESTS_MAX;
export const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
export const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
export const CORS = process.env.CORS || '*';
export const AUTH_CORS = process.env.AUTH_CORS || 'http://localhost:3000';
export const RATE_LIMIT_AUTH_WINDOW_MS = process.env.RATE_LIMIT_AUTH_WINDOW_MS;
export const RATE_LIMIT_AUTH_REQUESTS_MAX = process.env.RATE_LIMIT_AUTH_REQUESTS_MAX;
export const SENTRY_DSN = process.env.SENTRY_DSN;
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const LOG_REQUEST_INFO = process.env.LOG_REQUEST_INFO;
export const PORT = process.env.PORT || 8000;
export const AWS_S3_ENDPOINT = process.env.AWS_S3_ENDPOINT || undefined;
export const ENVIRONMENT = process.env.ENVIRONMENT || 'development';
export const ORY_ADMIN_HOST = process.env.ORY_ADMIN_HOST as string;

export const JWKS_URI = process.env.JWKS_URI as string;
export const QUADRATIC_FILE_URI = process.env.QUADRATIC_FILE_URI as string;
export const QUADRATIC_FILE_URI_PUBLIC = process.env.QUADRATIC_FILE_URI_PUBLIC as string;
export const AWS_S3_REGION = process.env.AWS_S3_REGION as string;
export const AWS_S3_ACCESS_KEY_ID = process.env.AWS_S3_ACCESS_KEY_ID as string;
export const AWS_S3_SECRET_ACCESS_KEY = process.env.AWS_S3_SECRET_ACCESS_KEY as string;
export const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME as string;
export const AWS_S3_ANALYTICS_BUCKET_NAME = process.env.AWS_S3_ANALYTICS_BUCKET_NAME as string;
export const GCP_REGION = process.env.GCP_REGION || 'us-central1';
export const GCP_REGION_ANTHROPIC = process.env.GCP_REGION_ANTHROPIC || 'us-east5';
export const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'GCP_PROJECT_ID';
export const GCP_CLIENT_EMAIL = process.env.GCP_CLIENT_EMAIL || 'GCP_CLIENT_EMAIL';
export const GCP_PRIVATE_KEY = process.env.GCP_PRIVATE_KEY || 'GCP_PRIVATE_KEY';
export const GCP_GEMINI_API_KEY = process.env.GCP_GEMINI_API_KEY || 'GCP_GEMINI_API_KEY';
export const MIXPANEL_TOKEN = process.env.MIXPANEL_TOKEN || undefined;
export const RAINDROP_API_KEY = process.env.RAINDROP_API_KEY || undefined;

// Optional Billing
export const BILLING_AI_USAGE_LIMIT = process.env.BILLING_AI_USAGE_LIMIT
  ? isNaN(Number(process.env.BILLING_AI_USAGE_LIMIT))
    ? undefined
    : Number(process.env.BILLING_AI_USAGE_LIMIT)
  : undefined;

// Maximum number of editable files for free teams (defaults to 5)
export const FREE_EDITABLE_FILE_LIMIT = process.env.FREE_EDITABLE_FILE_LIMIT
  ? Number(process.env.FREE_EDITABLE_FILE_LIMIT)
  : 5;

// AI allowance per user in dollars (defaults: Pro=$20, Business=$40)
export const AI_ALLOWANCE_PRO = process.env.AI_ALLOWANCE_PRO ? Number(process.env.AI_ALLOWANCE_PRO) : 20;
export const AI_ALLOWANCE_BUSINESS = process.env.AI_ALLOWANCE_BUSINESS ? Number(process.env.AI_ALLOWANCE_BUSINESS) : 40;

// Required
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY as string;
export const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY as string;
export const STORAGE_TYPE = process.env.STORAGE_TYPE as string;
export const AUTH_TYPE = process.env.AUTH_TYPE as string;
export const LICENSE_KEY = process.env.LICENSE_KEY as string;
export const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID as string;
export const PLAID_SECRET = process.env.PLAID_SECRET as string;
export const PLAID_ENVIRONMENT = process.env.PLAID_ENVIRONMENT as 'sandbox' | 'development' | 'production';
[
  'STRIPE_SECRET_KEY',
  'ENCRYPTION_KEY',
  'STORAGE_TYPE',
  'AUTH_TYPE',
  'LICENSE_KEY',
  'PLAID_CLIENT_ID',
  'PLAID_SECRET',
  'PLAID_ENVIRONMENT',
].forEach(ensureEnvVarExists);

// WorkOS
export const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID as string;
export const WORKOS_API_KEY = process.env.WORKOS_API_KEY as string;
if (process.env.AUTH_TYPE === 'workos') {
  ['WORKOS_CLIENT_ID', 'WORKOS_API_KEY'].forEach(ensureEnvVarExists);
}

// Required in prod, optional locally
export const M2M_AUTH_TOKEN = process.env.M2M_AUTH_TOKEN;
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
export const OPENAI_ORGANIZATION_ID = process.env.OPENAI_ORGANIZATION_ID || undefined;
export const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || 'AZURE_OPENAI_ENDPOINT';
export const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY || 'AZURE_OPENAI_API_KEY';
export const XAI_API_KEY = process.env.XAI_API_KEY || 'XAI_API_KEY';
export const BASETEN_API_KEY = process.env.BASETEN_API_KEY || 'BASETEN_API_KEY';
export const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY || 'FIREWORKS_API_KEY';
export const OPEN_ROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY || 'OPEN_ROUTER_API_KEY';
export const SLACK_FEEDBACK_URL = process.env.SLACK_FEEDBACK_URL;
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
export const CONNECTION_DEMO = process.env.CONNECTION_DEMO || '';
export const FINE_TUNE = process.env.FINE_TUNE || 'false';
export const RESTRICTED_MODEL_COUNTRIES = process.env.RESTRICTED_MODEL_COUNTRIES || '';

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

export const isRunningInTest = NODE_ENV === 'test';
export const debugAndNotInProduction = ENVIRONMENT !== 'production' && !!DEBUG;
