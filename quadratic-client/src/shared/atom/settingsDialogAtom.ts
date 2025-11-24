import { atom, getDefaultStore } from 'jotai';

export const settingsDialogAtom = atom<boolean>(false);

export const showSettingsDialog = () => {
  getDefaultStore().set(settingsDialogAtom, true);
};

export const hideSettingsDialog = () => {
  getDefaultStore().set(settingsDialogAtom, false);
};
