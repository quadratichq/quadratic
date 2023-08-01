import * as amplitude from '@amplitude/analytics-browser';
import { User } from '@auth0/auth0-spa-js';
import { setUser } from '@sentry/react';
import mixpanel from 'mixpanel-browser';
import { useEffect, useRef } from 'react';
import { useRouteLoaderData } from 'react-router-dom';
import { RootLoaderData } from '../../routes';

// Quadratic only shares analytics on the QuadraticHQ.com hosted version where the environment variables are set.

const loadGoogleAnalytics = async () => {
  if (!process.env.REACT_APP_GOOGLE_ANALYTICS_GTAG && process.env.REACT_APP_GOOGLE_ANALYTICS_GTAG !== 'none') {
    return;
  }

  // set up Google Analytics
  const script_1 = document.createElement('script');
  script_1.src = `https://www.googletagmanager.com/gtag/js?id=${process.env.REACT_APP_GOOGLE_ANALYTICS_GTAG}`;
  script_1.async = true;

  const script_2 = document.createElement('script');
  script_2.innerText = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${process.env.REACT_APP_GOOGLE_ANALYTICS_GTAG}');
      `;

  // add google analytics scripts to document
  if (typeof window !== 'undefined') {
    document.head.appendChild(script_1);
    document.head.appendChild(script_2);

    console.log('[Analytics] Google Analytics activated');
  }
};

const loadAmplitudeAnalytics = async (user: User | undefined) => {
  if (
    !process.env.REACT_APP_AMPLITUDE_ANALYTICS_API_KEY &&
    process.env.REACT_APP_AMPLITUDE_ANALYTICS_API_KEY !== 'none'
  ) {
    return;
  }

  amplitude.init(process.env.REACT_APP_AMPLITUDE_ANALYTICS_API_KEY, user?.sub, {
    defaultTracking: { sessions: true, pageViews: true, formInteractions: true, fileDownloads: true },
  });

  console.log('[Analytics] Amplitude activated');
};

const loadMixPanelAnalytics = async (user: User | undefined) => {
  if (!process.env.REACT_APP_MIXPANEL_ANALYTICS_KEY && process.env.REACT_APP_MIXPANEL_ANALYTICS_KEY !== 'none') {
    // Without init Mixpanel, all mixpanel events throw an error and break the app.
    // So we have to init Mixpanel with a fake key, and disable Mixpanel.
    mixpanel.init('FAKE_KEY');
    mixpanel.disable();
    return;
  }

  mixpanel.init(process.env.REACT_APP_MIXPANEL_ANALYTICS_KEY, { api_host: 'https://mixpanel-proxy.quadratichq.com' });

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
};

export default function Scripts({ children }: { children: JSX.Element }) {
  const didMount = useRef<boolean>(false);
  const { isAuthenticated, user } = useRouteLoaderData('root') as RootLoaderData;

  // Load analytics
  useEffect(() => {
    // Prevent loading twice
    if (didMount.current) return;
    didMount.current = true;

    loadGoogleAnalytics();
    loadAmplitudeAnalytics(user);
    loadMixPanelAnalytics(user);
  }, [user]);

  // Set user in Sentry
  useEffect(() => {
    if (isAuthenticated && user) {
      setUser({ email: user.email, id: user.sub });
      console.log('[Sentry] user set');
    }
  }, [isAuthenticated, user]);

  return children;
}
