import mixpanel from 'mixpanel-browser';
import { MIXPANEL_TOKEN } from '../env-vars';

if (MIXPANEL_TOKEN) {
  mixpanel.init(MIXPANEL_TOKEN);
}

export const trackEvent = (event: string, properties: Record<string, any>) => {
  if (MIXPANEL_TOKEN) {
    mixpanel.track(event, properties);
  }
};
