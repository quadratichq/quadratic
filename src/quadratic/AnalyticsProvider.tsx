import { useEffect, useState } from 'react';

export const AnalyticsProvider = () => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Only track analytics on hosted version
    if (!process.env.REACT_APP_GOOGLE_ANALYTICS_GTAG) {
      setLoaded(true);
      return;
    }

    if (loaded) return;

    console.log('activating...');

    // set up segment analytics
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

    if (typeof window !== 'undefined') {
      document.head.appendChild(script_1);
      document.head.appendChild(script_2);

      console.log('[Analytics] activated');
    }

    setLoaded(true);
  }, [loaded, setLoaded]);

  return null;
};
