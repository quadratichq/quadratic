import { events } from '@/app/events/events';
import type {
  CoreClientImportProgress,
  CoreClientTransactionStart,
} from '@/app/web-workers/quadraticCore/coreClientMessages';
import { filesImportProgressListAtom } from '@/dashboard/atoms/filesImportProgressListAtom';
import { atom, DefaultValue } from 'recoil';

export interface FileImportProgress {
  name: string;
  size: number;
  step: 'read' | 'create' | 'save' | 'done' | 'error' | 'cancel';
  progress: number;
  transactionId?: string;
  transactionOps?: number;
  uuid?: string;
  abortController?: AbortController;
}

interface FilesImportProgressState {
  importing: boolean;
  createNewFile: boolean;
  currentFileIndex?: number;
  files: FileImportProgress[];
}

const defaultFilesImportProgressState: FilesImportProgressState = {
  importing: false,
  createNewFile: false,
  currentFileIndex: undefined,
  files: [],
};

export const filesImportProgressAtom = atom({
  key: 'filesImportProgress',
  default: defaultFilesImportProgressState,
  effects: [
    ({ onSet, setSelf, getLoadable, resetSelf }) => {
      onSet((newValue, oldValue) => {
        if (oldValue instanceof DefaultValue) return;

        const handleImportProgress = (message: CoreClientImportProgress) => {
          setSelf((prev) => {
            if (prev instanceof DefaultValue) return prev;
            const updatedFiles = prev.files.map((file, index) => {
              if (index !== prev.currentFileIndex) return file;
              const totalSteps = prev.createNewFile ? 2 : 1;
              const newFile: FileImportProgress = {
                ...file,
                step: 'read',
                progress: Math.round((message.current / message.total) * 100) / totalSteps,
              };
              return newFile;
            });
            return {
              ...prev,
              files: updatedFiles,
            };
          });
        };

        const handleTransactionStart = (message: CoreClientTransactionStart) => {
          if (message.transactionName === 'Import') {
            setSelf((prev) => {
              if (prev instanceof DefaultValue) return prev;
              const updatedFiles = prev.files.map((file, index) => {
                if (index !== prev.currentFileIndex) return file;
                const totalSteps = prev.createNewFile ? 2 : 1;
                const newFile: FileImportProgress = {
                  ...file,
                  step: 'create',
                  progress: 100 / totalSteps,
                  transactionId: message.transactionId,
                  transactionOps: undefined,
                } as FileImportProgress;
                return newFile;
              });
              return {
                ...prev,
                files: updatedFiles,
              };
            });
          }
        };

        if (!oldValue.importing && newValue.importing) {
          // add event listeners
          events.on('importProgress', handleImportProgress);
          events.on('transactionStart', handleTransactionStart);
        } else if (oldValue.importing && !newValue.importing) {
          const filesImportProgressListState = getLoadable(filesImportProgressListAtom);
          // remove event listeners
          events.off('importProgress', handleImportProgress);
          events.off('transactionStart', handleTransactionStart);

          // reset state
          if (!filesImportProgressListState.contents.show) {
            resetSelf();
          }
        }
      });
    },
  ],
});
