import { atom, getDefaultStore } from 'jotai';

export const changelogDialogAtom = atom<boolean>(false);

export const showChangelogDialog = () => {
  getDefaultStore().set(changelogDialogAtom, true);
};

export const hideChangelogDialog = () => {
  getDefaultStore().set(changelogDialogAtom, false);
};
