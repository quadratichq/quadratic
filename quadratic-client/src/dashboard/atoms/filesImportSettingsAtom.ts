import { atom } from 'recoil';

export interface FileImportSettings {
  csvDelimiter?: number;
  hasHeading?: boolean;
}

interface FilesImportSettingsState {
  csvFile?: File;
  submitFn?: (settings: FileImportSettings) => void;
  cancelFn?: () => void;
}

const defaultFilesImportSettingsState: FilesImportSettingsState = {
  csvFile: undefined,
  submitFn: undefined,
  cancelFn: undefined,
};

export const filesImportSettingsAtom = atom({
  key: 'filesImportSettings',
  default: defaultFilesImportSettingsState,
});
