import Mixpanel from 'mixpanel';
import { MIXPANEL_TOKEN } from '../env-vars';

let mixpanel = null;
if (MIXPANEL_TOKEN) {
  mixpanel = Mixpanel.init(MIXPANEL_TOKEN);
}

export const trackEvent = (event: string, properties: Record<string, any>) => {
  if (MIXPANEL_TOKEN && mixpanel) {
    mixpanel.track(event, properties);
  }
};
