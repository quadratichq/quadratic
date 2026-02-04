import { registerEventAnalyticsData } from '@/shared/utils/analyticsEvents';
import { atom } from 'recoil';

export const AGENT_MODE_KEY = 'agentMode';

const DEFAULT_AGENT_MODE = false;

export const agentModeAtom = atom<boolean>({
  key: 'agentModeAtom',
  default: DEFAULT_AGENT_MODE,
  effects: [
    ({ setSelf, onSet }) => {
      // Initialize from localStorage & register analytics event
      const savedValue = localStorage.getItem(AGENT_MODE_KEY);
      if (savedValue !== null) {
        const agentMode = savedValue === 'true';
        setSelf(agentMode);
        registerEventAnalyticsData({ agentMode });
      } else {
        // Never been set? Register the default
        registerEventAnalyticsData({ agentMode: DEFAULT_AGENT_MODE });
      }

      // Persist to localStorage on change & update events analytics
      onSet((newValue, oldValue, isReset) => {
        if (isReset) {
          localStorage.removeItem(AGENT_MODE_KEY);
          registerEventAnalyticsData({ agentMode: DEFAULT_AGENT_MODE });
        } else {
          localStorage.setItem(AGENT_MODE_KEY, String(newValue));
          registerEventAnalyticsData({ agentMode: newValue });
        }
      });
    },
  ],
});
