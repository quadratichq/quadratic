/* eslint-disable eqeqeq */
// @ts-nocheck
import { useEffect, useState } from 'react';

function useIsHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}

export function GoogleTagManager() {
  const isHydrated = useIsHydrated();

  useEffect(() => {
    if (!isHydrated) return;
    console.warn('GoogleTagManager');

    (function (w, d, s, l, i) {
      w[l] = w[l] || [];
      w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      var f = d.getElementsByTagName(s)[0],
        j = d.createElement(s),
        dl = l != 'dataLayer' ? '&l=' + l : '';
      j.async = true;
      j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
      f.parentNode.insertBefore(j, f);
    })(window, document, 'script', 'dataLayer', 'GTM-MDFG6DX4');
  }, [isHydrated]);

  return null;
}

export function GoogleTagManagerNoScript() {
  const isHydrated = useIsHydrated();

  if (!isHydrated) return null;

  return (
    <noscript>
      <iframe
        src="https://www.googletagmanager.com/ns.html?id=GTM-MDFG6DX4"
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
        title="GTM"
      ></iframe>
    </noscript>
  );
}
