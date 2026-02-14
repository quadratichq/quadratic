import { atom, getDefaultStore } from 'jotai';

export type SettingsTab = 'general' | 'ai' | 'theme' | 'team' | 'team-members' | 'team-ai' | 'team-privacy' | 'debug';

export interface SettingsDialogState {
  open: boolean;
  initialTab?: SettingsTab;
  highlightOverage?: boolean;
}

export const settingsDialogAtom = atom<SettingsDialogState>({ open: false });

export const showSettingsDialog = (initialTab?: SettingsTab, options?: { highlightOverage?: boolean }) => {
  getDefaultStore().set(settingsDialogAtom, { open: true, initialTab, highlightOverage: options?.highlightOverage });
};

export const hideSettingsDialog = () => {
  getDefaultStore().set(settingsDialogAtom, { open: false });
};
