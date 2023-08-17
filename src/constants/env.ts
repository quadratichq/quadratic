import * as Sentry from '@sentry/react';

// This is to help clarify what vars are need through the app, and provides
// one central place for us to access them throughout the app.
// We default them all to empty strings when not set.

// Optional vars (without these, the app still functions)
export const REACT_APP_SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN || '';
export const REACT_APP_GOOGLE_ANALYTICS_GTAG = process.env.REACT_APP_GOOGLE_ANALYTICS_GTAG || '';
export const REACT_APP_AMPLITUDE_ANALYTICS_API_KEY = process.env.REACT_APP_AMPLITUDE_ANALYTICS_API_KEY || '';
export const REACT_APP_MIXPANEL_ANALYTICS_KEY = process.env.REACT_APP_MIXPANEL_ANALYTICS_KEY || '';
export const REACT_APP_DEBUG = process.env.REACT_APP_DEBUG || '';

// Required vars (without these the app will fail)
export const REACT_APP_AUTH0_DOMAIN = process.env.REACT_APP_AUTH0_DOMAIN || '';
export const REACT_APP_AUTH0_CLIENT_ID = process.env.REACT_APP_AUTH0_CLIENT_ID || '';
export const REACT_APP_AUTH0_AUDIENCE = process.env.REACT_APP_AUTH0_AUDIENCE || '';
export const REACT_APP_AUTH0_ISSUER = process.env.REACT_APP_AUTH0_ISSUER || '';
export const REACT_APP_QUADRATIC_API_URL = process.env.REACT_APP_QUADRATIC_API_URL || '';
export const REACT_APP_VERSION = process.env.REACT_APP_VERSION || '';
// Note: anytime you add another required var here, add it to the array below

// Bool for indicating that all required vars are present
export let ENV_VARS_ARE_CONFIGURED_CORRECTLY = true;
const requiredVarsByName = {
  REACT_APP_AUTH0_DOMAIN,
  REACT_APP_AUTH0_CLIENT_ID,
  REACT_APP_AUTH0_AUDIENCE,
  REACT_APP_AUTH0_ISSUER,
  REACT_APP_QUADRATIC_API_URL,
  REACT_APP_VERSION,
};
const missingRequiredVarNames = Object.entries(requiredVarsByName).filter(([key, value]) => {
  if (!value || typeof value !== 'string') {
    ENV_VARS_ARE_CONFIGURED_CORRECTLY = false;
    console.error('Expected a value for the env variable `%s` but got `%s`', key, value);
    return true;
  }
  return false;
});
// Log to sentry if something's off
if (!ENV_VARS_ARE_CONFIGURED_CORRECTLY) {
  Sentry.captureEvent({
    message: '',
    level: Sentry.Severity.Fatal,
    extra: { missingRequiredVarNames },
  });
}
