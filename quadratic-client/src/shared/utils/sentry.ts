import {
  browserProfilingIntegration,
  browserSessionIntegration,
  browserTracingIntegration,
  captureConsoleIntegration,
  extraErrorDataIntegration,
  httpClientIntegration,
  init,
  zodErrorsIntegration,
} from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;
const environment = import.meta.env.VITE_ENVIRONMENT ?? 'development';
const version = import.meta.env.VITE_VERSION;

export const initSentry = () => {
  try {
    if (dsn && dsn !== 'none') {
      init({
        dsn,
        environment,
        release: `quadratic@${version}`,
        integrations: [
          browserProfilingIntegration(),
          browserSessionIntegration(),
          browserTracingIntegration(),
          captureConsoleIntegration({ levels: ['error', 'warn'] }),
          extraErrorDataIntegration(),
          httpClientIntegration(),
          zodErrorsIntegration(),
        ],
        profilesSampleRate: 1.0,
        tracesSampleRate: 1.0,
      });
    }
  } catch (error) {
    console.error('Error initializing Sentry', error);
  }
};
