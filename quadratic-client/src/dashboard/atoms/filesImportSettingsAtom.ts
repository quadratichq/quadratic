import { atom } from 'recoil';

export interface FileImportSettings {
  csvDelimiter?: number;
}

interface FilesImportSettingsState {
  callbackFn?: (settings: FileImportSettings) => void;
}

const defaultFilesImportSettingsState: FilesImportSettingsState = {
  callbackFn: undefined,
};

export const filesImportSettingsAtom = atom({
  key: 'filesImportSettings',
  default: defaultFilesImportSettingsState,
});
