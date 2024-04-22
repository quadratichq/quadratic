import { debugShow } from '@/debugFlags';
import * as amplitude from '@amplitude/analytics-browser';
import { User as Auth0User } from '@auth0/auth0-spa-js';
import { setUser } from '@sentry/react';
import mixpanel from 'mixpanel-browser';
import { isDesktop } from 'react-device-detect';

// Quadratic only shares analytics on the QuadraticHQ.com hosted version where the environment variables are set.

type User = Auth0User | undefined;

export function googleAnalyticsAvailable(): boolean {
  return import.meta.env.VITE_GOOGLE_ANALYTICS_GTAG && import.meta.env.VITE_GOOGLE_ANALYTICS_GTAG !== 'none';
}

// This runs in the root loader, so analytics calls can run inside loaders.
export function initializeAnalytics(user: User) {
  triggerGTagConversion(user);
  initAmplitudeAnalytics(user);
  initMixpanelAnalytics(user);
  configureSentry(user);
}

function triggerGTagConversion(user: User) {
  if (!googleAnalyticsAvailable()) return;

  // This is a conversion event for desktop signups.

  if (isDesktop) {
    //@ts-expect-error
    gtag('event', 'conversion', {
      send_to: import.meta.env.VITE_GOOGLE_ANALYTICS_GTAG,
      email: user?.email,
    });

    if (debugShow) console.log('[Analytics] Google activated');
  }
}

function initAmplitudeAnalytics(user: User) {
  if (
    !import.meta.env.VITE_AMPLITUDE_ANALYTICS_API_KEY &&
    import.meta.env.VITE_AMPLITUDE_ANALYTICS_API_KEY !== 'none'
  ) {
    return;
  }

  amplitude.init(import.meta.env.VITE_AMPLITUDE_ANALYTICS_API_KEY, user?.sub, {
    defaultTracking: { sessions: true, pageViews: true, formInteractions: true, fileDownloads: true },
  });

  if (debugShow) console.log('[Analytics] Amplitude activated');
}

export function initMixpanelAnalytics(user: User) {
  if (!import.meta.env.VITE_MIXPANEL_ANALYTICS_KEY && import.meta.env.VITE_MIXPANEL_ANALYTICS_KEY !== 'none') {
    // Without init Mixpanel, all mixpanel events throw an error and break the app.
    // So we have to init Mixpanel with a fake key, and disable Mixpanel.
    mixpanel.init('FAKE_KEY');
    mixpanel.disable();
    return;
  }

  mixpanel.init(import.meta.env.VITE_MIXPANEL_ANALYTICS_KEY, {
    api_host: 'https://mixpanel-proxy.quadratichq.com',
  });

  mixpanel.register({
    email: user?.email,
    distinct_id: user?.sub,
  });

  mixpanel.identify(user?.sub);

  mixpanel.people.set_once({
    $distinct_id: user?.sub,
    $email: user?.email,
    $name: user?.name,
    $avatar: user?.picture,
  });

  console.log('[Analytics] Mixpanel activated');
}

function configureSentry(user: User) {
  if (user) {
    setUser({ email: user.email, id: user.sub });
    if (debugShow) console.log('[Analytics] Sentry user set');
  }
}
