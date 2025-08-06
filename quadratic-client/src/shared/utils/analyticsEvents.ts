import type { User } from '@/auth/auth';
import { getUtmDataFromCookie } from '@/shared/utils/getUtmDataFromCookie';
import mixpanel from 'mixpanel-browser';
// posthog is meant to be an example of how we could use multiple event analytics
// providers at the same time and have it all centralized here.
// import posthog from 'posthog-js';

/**
 *
 * CONFIGURE PROVIDERS
 *
 */

const MIXPANEL_KEY: string =
  import.meta.env.VITE_MIXPANEL_ANALYTICS_KEY && import.meta.env.VITE_MIXPANEL_ANALYTICS_KEY !== 'none'
    ? import.meta.env.VITE_MIXPANEL_ANALYTICS_KEY
    : '';
const isMixpanelEnabled = Boolean(MIXPANEL_KEY);

// const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_ANALYTICS_KEY && import.meta.env.VITE_POSTHOG_ANALYTICS_KEY !== 'none' ? import.meta.env.VITE_POSTHOG_ANALYTICS_KEY : 'FAKE_KEY';
// const isPosthogEnabled = Boolean(POSTHOG_KEY);

/**
 *
 * INITIALIZE (ON MODULE IMPORT)
 *
 */

if (isMixpanelEnabled) {
  mixpanel.init(MIXPANEL_KEY, {
    api_host: 'https://mixpanel-proxy.quadratichq.com',
    cross_subdomain_cookie: true,
    cookie_domain: '.quadratichq.com',
  });
}

// if (isPosthogEnabled) {…}

/**
 *
 * PUBLIC API
 *
 */

export function trackEvent(event: string, properties?: Record<string, any>, callback?: () => void) {
  // Only run SDKs that are enabled

  if (isMixpanelEnabled) {
    mixpanel.track(event, properties, callback);
  }

  // if (isPosthogEnabled) {…}
}

export function resetEventAnalytics() {
  if (isMixpanelEnabled) {
    mixpanel.reset();
  }

  // if (isPosthogEnabled) {…}
}

export function identifyEventAnalyticsUser(user: User) {
  if (isMixpanelEnabled) {
    startMixpanel(user);
  }

  // if (isPosthogEnabled) {
  //   startPosthog(user);
  // }
}

export function registerEventAnalyticsData(data: Record<string, any>) {
  if (isMixpanelEnabled) {
    mixpanel.register(data);
  }

  // if (isPosthogEnabled) {
  //   ...
  // }
}

/**
 *
 * SESSION START MANAGEMENT
 *
 */

// Mixpanel identity management best practices:
// https://docs.mixpanel.com/docs/tracking-methods/id-management/identifying-users-simplified#best-practices
function startMixpanel(user: User) {
  const utmData = getUtmDataFromCookie();

  // Identify the user
  mixpanel.identify(user.sub);

  // Globally register stuff we want to send with every event
  mixpanel.register({
    email: user.email,
    ...utmData,
  });

  // Set properties from the auth service to the user's profile in mixpanel
  mixpanel.people.set_once({
    $email: user.email,
    $name: user.name,
    $avatar: user.picture,
    ...utmData,
  });

  // After calling identify, we're supposed to send an event, so we use just a
  // dummy event here
  trackEvent('[mixpanel].identify');
}

// function startPosthog(user: User) {…}
