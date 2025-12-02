import { atom, getDefaultStore } from 'jotai';

export interface SettingsDialogState {
  open: boolean;
  initialTab?: string;
}

export const settingsDialogAtom = atom<SettingsDialogState>({ open: false });

export const showSettingsDialog = (initialTab?: string) => {
  getDefaultStore().set(settingsDialogAtom, { open: true, initialTab });
};

export const hideSettingsDialog = () => {
  getDefaultStore().set(settingsDialogAtom, { open: false });
};
