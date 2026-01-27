import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { atom } from 'recoil';

const AGENT_MODE_KEY = 'agentMode';

export const agentModeAtom = atom<boolean>({
  key: 'agentModeAtom',
  default: false,
  effects: [
    ({ setSelf, onSet }) => {
      // Initialize from localStorage
      const savedValue = localStorage.getItem(AGENT_MODE_KEY);
      if (savedValue !== null) {
        setSelf(savedValue === 'true');
      }

      // Persist to localStorage on change
      onSet((newValue, oldValue, isReset) => {
        if (isReset) {
          localStorage.removeItem(AGENT_MODE_KEY);
        } else {
          localStorage.setItem(AGENT_MODE_KEY, String(newValue));

          // Close AI Analyst when exiting agent mode
          if (oldValue === true && newValue === false) {
            pixiAppSettings.setAIAnalystState?.((prev) => ({ ...prev, showAIAnalyst: false }));
          }
        }
      });
    },
  ],
});
