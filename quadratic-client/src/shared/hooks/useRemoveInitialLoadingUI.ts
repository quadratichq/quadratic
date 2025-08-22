import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useLayoutEffect } from 'react';

export function useRemoveInitialLoadingUI() {
  const { debug } = useDebugFlags();

  useLayoutEffect(() => {
    // Get the initial start time (in ms) so we can track the load time
    const startTime = document.documentElement.getAttribute('data-loading-start');

    // Remove the attribute, which will hide the loading UI
    document.documentElement.removeAttribute('data-loading-start');

    // If we don't have a start time, don't track the load time
    if (!startTime) {
      return;
    }
    const startTimeMs = Number(startTime);
    const loadTimeMs = Date.now() - startTimeMs;
    if (debug) {
      console.log(`Loading time: ${loadTimeMs}ms`);
    }
    const route = window.location.pathname + window.location.search;
    trackEvent('[Loading].complete', {
      route,
      loadTimeMs,
    });
  }, [debug]);
  return null;
}
