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
// Note: anytime you add another required var here, add it to the object below
const requiredVarsByName = {
  REACT_APP_AUTH0_DOMAIN,
  REACT_APP_AUTH0_CLIENT_ID,
  REACT_APP_AUTH0_AUDIENCE,
  REACT_APP_AUTH0_ISSUER,
  REACT_APP_QUADRATIC_API_URL,
  REACT_APP_VERSION,
};

// Check and make sure we have all the vars we expect
const missingRequiredVarNames = Object.keys(requiredVarsByName).filter(
  (name) =>
    //@ts-expect-error
    requiredVarsByName[name].length === 0
);
export let envVarsAreConfiguredCorrectly = Boolean(missingRequiredVarNames.length === 0);
if (!envVarsAreConfiguredCorrectly) {
  // Log missing ones to the console & then sentry
  missingRequiredVarNames.forEach((name: string) => {
    // @ts-expect-error
    console.error('Expected a value for the env variable `%s` but got `%s`', name, requiredVarsByName[name]);
  });
  Sentry.captureEvent({
    message: '',
    level: Sentry.Severity.Fatal,
    extra: { missingRequiredVarNames },
  });
}
