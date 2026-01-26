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
      onSet((newValue, _, isReset) => {
        if (isReset) {
          localStorage.removeItem(AGENT_MODE_KEY);
        } else {
          localStorage.setItem(AGENT_MODE_KEY, String(newValue));
        }
      });
    },
  ],
});
