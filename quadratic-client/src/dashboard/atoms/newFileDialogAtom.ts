import { atom } from 'recoil';

interface NewFileDialogState {
  show: boolean;
}

const defaultNewFileDialogState: NewFileDialogState = {
  show: false,
};

export const newFileDialogAtom = atom({
  key: 'newFileDialog',
  default: defaultNewFileDialogState,
});
