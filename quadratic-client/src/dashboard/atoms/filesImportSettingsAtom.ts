import { atom } from 'recoil';

export interface FileImportSettings {
  csvDelimiter?: number;
  hasHeader?: boolean;
}

interface FilesImportSettingsState {
  callbackFn?: (settings: FileImportSettings) => void;
  csvFile?: File;
}

const defaultFilesImportSettingsState: FilesImportSettingsState = {
  callbackFn: undefined,
  csvFile: undefined,
};

export const filesImportSettingsAtom = atom({
  key: 'filesImportSettings',
  default: defaultFilesImportSettingsState,
});
