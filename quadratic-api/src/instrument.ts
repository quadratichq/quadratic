import {
  consoleIntegration,
  extraErrorDataIntegration,
  httpIntegration,
  init,
  prismaIntegration,
  zodErrorsIntegration,
} from '@sentry/node';
import { SENTRY_DSN, VERSION } from './env-vars';

// Sentry's auto-discovered AI integrations (Anthropic_AI, OpenAI, Google_GenAI)
// unconditionally capture every AI SDK error as `handled: false`. The
// application already has comprehensive AI error handling with fallback logic,
// user-friendly messages, and selective Sentry reporting in ai.handler.ts, so
// the auto-integrations just create duplicate noise.
const DISABLED_AUTO_AI_INTEGRATIONS = new Set(['Anthropic_AI', 'OpenAI', 'Google_GenAI']);

// Configure Sentry
if (SENTRY_DSN) {
  init({
    dsn: SENTRY_DSN,
    release: `quadratic@${VERSION}`,
    integrations: (defaults) => [
      ...defaults.filter((i) => !DISABLED_AUTO_AI_INTEGRATIONS.has(i.name)),
      consoleIntegration({ levels: ['error', 'warn'] }),
      extraErrorDataIntegration(),
      httpIntegration(),
      prismaIntegration(),
      zodErrorsIntegration(),
    ],
    tracesSampleRate: 1.0,
  });
}
