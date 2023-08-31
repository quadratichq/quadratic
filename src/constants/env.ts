// This is to help clarify what vars are need through the app, and provides
// one central place for us to access them throughout the app.
// We default them all to empty strings when not set.

// Optional vars (without these, the app still functions)
export const REACT_APP_SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN;
export const REACT_APP_GOOGLE_ANALYTICS_GTAG = process.env.REACT_APP_GOOGLE_ANALYTICS_GTAG;
export const REACT_APP_AMPLITUDE_ANALYTICS_API_KEY = process.env.REACT_APP_AMPLITUDE_ANALYTICS_API_KEY;
export const REACT_APP_MIXPANEL_ANALYTICS_KEY = process.env.REACT_APP_MIXPANEL_ANALYTICS_KEY;
export const REACT_APP_DEBUG = process.env.REACT_APP_DEBUG;

// Required vars (without these the app will fail)
// We cast them all as strings because we guarantee they'll be set before the app builds/starts
export const REACT_APP_AUTH0_DOMAIN = process.env.REACT_APP_AUTH0_DOMAIN as string;
export const REACT_APP_AUTH0_CLIENT_ID = process.env.REACT_APP_AUTH0_CLIENT_ID as string;
export const REACT_APP_AUTH0_AUDIENCE = process.env.REACT_APP_AUTH0_AUDIENCE as string;
export const REACT_APP_AUTH0_ISSUER = process.env.REACT_APP_AUTH0_ISSUER as string;
export const REACT_APP_QUADRATIC_API_URL = process.env.REACT_APP_QUADRATIC_API_URL as string;
export const REACT_APP_VERSION = process.env.REACT_APP_VERSION as string;
// Note: anytime you add another required var here, add it to the object below
// These are read by the build step to ensure we have all the env vars before building
export const requiredVarValuesByName = {
  REACT_APP_AUTH0_DOMAIN,
  REACT_APP_AUTH0_CLIENT_ID,
  REACT_APP_AUTH0_AUDIENCE,
  REACT_APP_AUTH0_ISSUER,
  REACT_APP_QUADRATIC_API_URL,
  REACT_APP_VERSION,
};
