import {
  consoleIntegration,
  extraErrorDataIntegration,
  httpIntegration,
  init,
  prismaIntegration,
  zodErrorsIntegration,
} from '@sentry/node';
import { SENTRY_DSN, VERSION } from './env-vars';

// Configure Sentry
if (SENTRY_DSN) {
  init({
    dsn: SENTRY_DSN,
    release: `quadratic@${VERSION}`,
    integrations: [
      consoleIntegration({ levels: ['error', 'warn'] }),
      extraErrorDataIntegration(),
      httpIntegration(),
      prismaIntegration(),
      zodErrorsIntegration(),
    ],
    tracesSampleRate: 1.0,
  });
}
