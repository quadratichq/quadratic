import { atom, getDefaultStore } from 'jotai';

interface OverageDialogState {
  open: boolean;
}

export const overageDialogAtom = atom<OverageDialogState>({ open: false });

export const showOverageDialog = () => {
  getDefaultStore().set(overageDialogAtom, { open: true });
};

export const hideOverageDialog = () => {
  getDefaultStore().set(overageDialogAtom, { open: false });
};
