import { atom } from 'recoil';

interface NewFileDialogState {
  show: boolean;
  isPrivate: boolean;
}

const defaultNewFileDialogState: NewFileDialogState = {
  show: false,
  isPrivate: true,
};

export const newFileDialogAtom = atom({
  key: 'newFileDialog',
  default: defaultNewFileDialogState,
});
