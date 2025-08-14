import type { AtomEffect } from 'recoil';
import { atom } from 'recoil';

const SETTINGS_KEY = 'aiConversation';

export type AIConversationState = {
  show: boolean;
};

export const defaultAIConversationState: AIConversationState = {
  show: false,
};

// Persist the GridSettings
const localStorageEffect: AtomEffect<AIConversationState> = ({ setSelf, onSet }) => {
  // Initialize from localStorage
  // Note: presentationMode is always off on a fresh page reload
  const savedValue = localStorage.getItem(SETTINGS_KEY);
  if (savedValue != null) {
    const settings = JSON.parse(savedValue);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setSelf(settings);
  }

  onSet((newValue, _, isReset) => {
    isReset ? localStorage.removeItem(SETTINGS_KEY) : localStorage.setItem(SETTINGS_KEY, JSON.stringify(newValue));
  });
};

export const aiConversationAtom = atom({
  key: SETTINGS_KEY,
  default: defaultAIConversationState,
  effects: [localStorageEffect],
});
