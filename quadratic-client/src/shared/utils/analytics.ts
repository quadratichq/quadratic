import { debugFlag } from '@/app/debugFlags/debugFlags';
import type { User as AuthUser } from '@/auth/auth';
import { identifyEventAnalyticsUser } from '@/shared/utils/analyticsEvents';
import { getUtmDataFromCookie } from '@/shared/utils/getUtmDataFromCookie';
import * as amplitude from '@amplitude/analytics-browser';
import { setUser } from '@sentry/react';

// Quadratic only shares analytics on the QuadraticHQ.com hosted version where the environment variables are set.

type User = AuthUser | undefined;

export function googleAnalyticsAvailable(): boolean {
  return import.meta.env.VITE_GOOGLE_ANALYTICS_GTAG && import.meta.env.VITE_GOOGLE_ANALYTICS_GTAG !== 'none';
}

// This runs in the root loader, so analytics calls can run inside loaders.
export function initializeAnalytics(user: User) {
  loadGoogleAnalytics(user);
  initAmplitudeAnalytics(user);
  if (user) identifyEventAnalyticsUser(user);
  configureSentry(user);
}

function loadGoogleAnalytics(user: User) {
  if (!googleAnalyticsAvailable()) return;
  const email = user?.email || '';
  const utmData = getUtmDataFromCookie();

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
              },
              ${utmData.utm_source ? `'utmSource': '${utmData.utm_source}',` : ''}
              ${utmData.utm_medium ? `'utmMedium': '${utmData.utm_medium}',` : ''}
              ${utmData.utm_campaign ? `'utmCampaign': '${utmData.utm_campaign}',` : ''}
              ${utmData.utm_content ? `'utmContent': '${utmData.utm_content}',` : ''}
              ${utmData.utm_term ? `'utmTerm': '${utmData.utm_term}',` : ''}
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

    if (debugFlag('debugShow')) console.log('[Analytics] Google activated with UTM data:', utmData);
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

  if (debugFlag('debugShow')) console.log('[Analytics] Amplitude activated');
}

function configureSentry(user: User) {
  if (user) {
    setUser({ email: user.email, id: user.sub });
    if (debugFlag('debugShow')) console.log('[Analytics] Sentry user set');
  }
}
