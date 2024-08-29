import { atom } from 'recoil';

interface FilesImportProgressListState {
  show: boolean;
}

const defaultFilesImportProgressListState: FilesImportProgressListState = {
  show: false,
};

export const filesImportProgressListAtom = atom({
  key: 'filesImportProgressList',
  default: defaultFilesImportProgressListState,
});
