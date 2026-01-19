import { atom, getDefaultStore } from 'jotai';

export type SettingsTab = 'general' | 'ai' | 'theme' | 'team' | 'team-members' | 'team-ai' | 'team-privacy' | 'debug';

export const settingsDialogAtom = atom<{ open: boolean; initialTab?: SettingsTab }>({ open: false });

export const showSettingsDialog = (initialTab?: SettingsTab) => {
  getDefaultStore().set(settingsDialogAtom, { open: true, initialTab });
};

export const hideSettingsDialog = () => {
  getDefaultStore().set(settingsDialogAtom, { open: false });
};
