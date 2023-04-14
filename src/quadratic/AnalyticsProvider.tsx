import { useEffect, useState } from 'react';
import * as amplitude from '@amplitude/analytics-browser';
import { useAuth0, User } from '@auth0/auth0-react';
import mixpanel from 'mixpanel-browser';

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
    mixpanel.init('FAKE_KEY');
    mixpanel.disable();
    return;
  }

  mixpanel.init(process.env.REACT_APP_MIXPANEL_ANALYTICS_KEY);

  mixpanel.register({
    email: user?.email,
  });

  mixpanel.identify(user?.sub);

  console.log('[Analytics] Mixpanel activated');
};

export const AnalyticsProvider = () => {
  const [loaded, setLoaded] = useState(false);
  const { user } = useAuth0();

  useEffect(() => {
    // Prevent loading twice
    if (loaded) return;
    setLoaded(true);

    loadGoogleAnalytics();
    loadAmplitudeAnalytics(user);
    loadMixPanelAnalytics(user);
  }, [loaded, setLoaded, user]);

  return null;
};
