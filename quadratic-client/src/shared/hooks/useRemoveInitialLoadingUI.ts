import { startupTimer } from '@/app/gridGL/helpers/startupTimer';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useLayoutEffect } from 'react';

export function useRemoveInitialLoadingUI() {
  useLayoutEffect(() => {
    // Get the initial start time (in ms) so we can track the load time
    const startTime = document.documentElement.getAttribute('data-loading-start');

    // Remove the attribute, which will hide the loading UI
    document.documentElement.removeAttribute('data-loading-start');

    // If we don't have a start time, don't track the load time
    if (startTime) {
      startupTimer.start('firstRender', Number(startTime));
      startupTimer.end('firstRender');
    }

    const timers = startupTimer.show();
    if (timers) {
      trackEvent('[Loading].complete', {
        route: window.location.pathname + window.location.search,
        ...timers,
      });
    }
  }, []);
  return null;
}
