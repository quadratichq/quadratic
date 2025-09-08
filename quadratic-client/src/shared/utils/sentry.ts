import {
  browserProfilingIntegration,
  browserSessionIntegration,
  browserTracingIntegration,
  captureConsoleIntegration,
  extraErrorDataIntegration,
  getClient,
  httpClientIntegration,
  init,
  replayCanvasIntegration,
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
        sendDefaultPii: true,
        integrations: [
          browserProfilingIntegration(),
          browserSessionIntegration(),
          browserTracingIntegration(),
          captureConsoleIntegration({ levels: ['error', 'warn'] }),
          extraErrorDataIntegration(),
          httpClientIntegration(),
          replayIntegration({ maskAllText: false, blockAllMedia: false }),
          replayCanvasIntegration({ enableManualSnapshot: true, quality: 'high' }),
          zodErrorsIntegration(),
        ],
        profilesSampleRate: 1.0,
        replaysSessionSampleRate: 1.0,
        replaysOnErrorSampleRate: 1.0,
        tracesSampleRate: 1.0,
      });
    }
  } catch (error) {
    console.error('Error initializing Sentry', error);
  }
};

interface ReplayCanvasIntegration {
  name: string;
  snapshot: (canvas: HTMLCanvasElement) => void;
}
export const captureSnapshotSentry = (canvas: HTMLCanvasElement) => {
  try {
    if (dsn && dsn !== 'none') {
      getClient()?.getIntegrationByName<ReplayCanvasIntegration>('ReplayCanvas')?.snapshot?.(canvas);
    }
  } catch (error) {
    console.error('Error capturing snapshot Sentry', error);
  }
};
