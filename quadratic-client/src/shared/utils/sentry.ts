import {
  browserProfilingIntegration,
  browserSessionIntegration,
  browserTracingIntegration,
  captureConsoleIntegration,
  extraErrorDataIntegration,
  httpClientIntegration,
  init,
  replayIntegration,
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
        replaysSessionSampleRate: 1.0,
        replaysOnErrorSampleRate: 1.0,
        integrations: [
          browserProfilingIntegration(),
          browserSessionIntegration(),
          browserTracingIntegration(),
          captureConsoleIntegration({ levels: ['error', 'warn'] }),
          extraErrorDataIntegration(),
          httpClientIntegration(),
          zodErrorsIntegration(),
          replayIntegration({
            maskAllText: false,
            blockAllMedia: false,
            networkDetailDenyUrls: ['/iframe-indexeddb'],
          }),
          // Canvas is not supported by default, but if we ever need to turn it
          // on, we explored that once here:
          // https://github.com/quadratichq/quadratic/pull/3422/commits/c2f6d31a9bbf9035dfa1f3dd2f0840ca138adf3b
        ],
        profilesSampleRate: 1.0,
        tracesSampleRate: 1.0,
      });
    }
  } catch (error) {
    console.error('Error initializing Sentry', error);
  }
};
