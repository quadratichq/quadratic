import { debugShow } from '@/app/debugFlags';
import { User as AuthUser } from '@/auth/auth';
import * as amplitude from '@amplitude/analytics-browser';
import { setUser } from '@sentry/react';
import mixpanel from 'mixpanel-browser';

// Quadratic only shares analytics on the QuadraticHQ.com hosted version where the environment variables are set.

type User = AuthUser | undefined;

export function googleAnalyticsAvailable(): boolean {
  return import.meta.env.VITE_GOOGLE_ANALYTICS_GTAG && import.meta.env.VITE_GOOGLE_ANALYTICS_GTAG !== 'none';
}

// This runs in the root loader, so analytics calls can run inside loaders.
export function initializeAnalytics(user: User) {
  loadGoogleAnalytics(user);
  initAmplitudeAnalytics(user);
  initMixpanelAnalytics(user);
  configureSentry(user);
}

function loadGoogleAnalytics(user: User) {
  if (!googleAnalyticsAvailable()) return;
  const email = user?.email || '';

  // set up Google Analytics
  const script_1 = document.createElement('script');
  script_1.src = `https://www.googletagmanager.com/gtag/js?id=${import.meta.env.VITE_GOOGLE_ANALYTICS_GTAG}`;
  script_1.async = true;

  const script_2 = document.createElement('script');
  script_2.innerText = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){
          dataLayer.push(arguments);
          const email = '${email}';
          if (email) {
            dataLayer.push({
              'event': 'Pageview',
              'userData': {
                'email': email
              }
            });
          }
        }
        gtag('js', new Date());
        gtag('config', '${import.meta.env.VITE_GOOGLE_ANALYTICS_GTAG}');
      `;

  // add google analytics scripts to document
  if (typeof window !== 'undefined') {
    document.head.appendChild(script_1);
    document.head.appendChild(script_2);

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
    cross_subdomain_cookie: true,
    cookie_domain: '.quadratichq.com',
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
