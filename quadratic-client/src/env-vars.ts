// throws an error if an expected environmental variable is not set
function ensureEnvVarExists(key: string) {
  if (!import.meta.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const VITE_GOOGLE_ANALYTICS_GTAG = import.meta.env.VITE_GOOGLE_ANALYTICS_GTAG;
export const VITE_AMPLITUDE_ANALYTICS_API_KEY = import.meta.env.VITE_AMPLITUDE_ANALYTICS_API_KEY;
export const VITE_MIXPANEL_ANALYTICS_KEY = import.meta.env.VITE_MIXPANEL_ANALYTICS_KEY;
export const VITE_SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

export const VITE_AUTH_TYPE = import.meta.env.VITE_AUTH_TYPE;
export const VITE_WORKOS_CLIENT_ID = import.meta.env.VITE_WORKOS_CLIENT_ID;
export const VITE_WORKOS_AUTH_URL = import.meta.env.VITE_WORKOS_AUTH_URL;
export const VITE_WORKOS_API = import.meta.env.VITE_WORKOS_API;
export const VITE_WORKOS_API_SECURE = import.meta.env.VITE_WORKOS_API_SECURE;
if (VITE_AUTH_TYPE === 'workos') {
  ['VITE_WORKOS_CLIENT_ID', 'VITE_WORKOS_AUTH_URL', 'VITE_WORKOS_API', 'VITE_WORKOS_API_SECURE'].forEach(
    ensureEnvVarExists
  );
}

export const VITE_QUADRATIC_API_URL = import.meta.env.VITE_QUADRATIC_API_URL;
export const VITE_QUADRATIC_MULTIPLAYER_URL = import.meta.env.VITE_QUADRATIC_MULTIPLAYER_URL;
export const VITE_QUADRATIC_CONNECTION_URL = import.meta.env.VITE_QUADRATIC_CONNECTION_URL;
['VITE_QUADRATIC_API_URL', 'VITE_QUADRATIC_MULTIPLAYER_URL', 'VITE_QUADRATIC_CONNECTION_URL'].forEach(
  ensureEnvVarExists
);

export const VITE_STORAGE_TYPE = import.meta.env.VITE_STORAGE_TYPE;
ensureEnvVarExists('VITE_STORAGE_TYPE');
