export const ensureEnvVarExists = (key: string) => {
  if (!(key in import.meta.env)) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
};

export const VITE_DEBUG = import.meta.env.VITE_DEBUG;

export const VITE_AUTH_TYPE = import.meta.env.VITE_AUTH_TYPE;
ensureEnvVarExists('VITE_AUTH_TYPE');

export const VITE_WORKOS_CLIENT_ID = import.meta.env.VITE_WORKOS_CLIENT_ID;
if (VITE_AUTH_TYPE === 'workos') {
  ensureEnvVarExists('VITE_WORKOS_CLIENT_ID');
}

export const VITE_ORY_HOST = import.meta.env.VITE_ORY_HOST;
if (VITE_AUTH_TYPE === 'ory') {
  ensureEnvVarExists('VITE_ORY_HOST');
}

export const VITE_QUADRATIC_API_URL = import.meta.env.VITE_QUADRATIC_API_URL;
export const VITE_QUADRATIC_MULTIPLAYER_URL = import.meta.env.VITE_QUADRATIC_MULTIPLAYER_URL;
export const VITE_QUADRATIC_CONNECTION_URL = import.meta.env.VITE_QUADRATIC_CONNECTION_URL;
['VITE_QUADRATIC_API_URL', 'VITE_QUADRATIC_MULTIPLAYER_URL', 'VITE_QUADRATIC_CONNECTION_URL'].forEach(
  ensureEnvVarExists
);

export const VITE_STORAGE_TYPE = import.meta.env.VITE_STORAGE_TYPE;
ensureEnvVarExists('VITE_STORAGE_TYPE');
