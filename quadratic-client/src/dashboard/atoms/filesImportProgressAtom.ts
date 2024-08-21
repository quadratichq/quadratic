import { events } from '@/app/events/events';
import {
  CoreClientImportProgress,
  CoreClientTransactionProgress,
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
    ({ onSet, setSelf, getLoadable }) => {
      onSet((newValue, oldValue) => {
        if (oldValue instanceof DefaultValue) return;

        const handleImportProgress = (message: CoreClientImportProgress) => {
          setSelf((prev) => {
            if (prev instanceof DefaultValue) return prev;
            const updatedFiles = prev.files.map((file, index) => {
              if (index !== prev.currentFileIndex) return file;
              const newFile: FileImportProgress = {
                ...file,
                step: 'read',
                progress: Math.round((message.current / message.total) * 100) / 3,
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
          if (message.transactionType === 'Import') {
            setSelf((prev) => {
              if (prev instanceof DefaultValue) return prev;
              const updatedFiles = prev.files.map((file, index) => {
                if (index !== prev.currentFileIndex) return file;
                const newFile: FileImportProgress = {
                  ...file,
                  step: 'create',
                  progress: 100 / 3,
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

        const handleTransactionProgress = (message: CoreClientTransactionProgress) => {
          setSelf((prev) => {
            if (prev instanceof DefaultValue) return prev;
            const updatedFiles = prev.files.map((file) => {
              if (file.transactionId !== message.transactionId) return file;
              const transactionOps = Math.max(file.transactionOps ?? 0, message.remainingOperations);
              const totalSteps = prev.createNewFile ? 3 : 2;
              const progress =
                (Math.round((1 - message.remainingOperations / transactionOps) * 100) + 100) / totalSteps;
              const newFile: FileImportProgress = {
                ...file,
                step: 'create',
                progress,
                transactionOps,
              };
              return newFile;
            });
            return {
              ...prev,
              files: updatedFiles,
            };
          });
        };

        if (!oldValue.importing && newValue.importing) {
          // add event listeners
          events.on('importProgress', handleImportProgress);
          events.on('transactionStart', handleTransactionStart);
          events.on('transactionProgress', handleTransactionProgress);
        } else if (oldValue.importing && !newValue.importing) {
          const filesImportProgressListState = getLoadable(filesImportProgressListAtom);
          // remove event listeners
          events.off('importProgress', handleImportProgress);
          events.off('transactionStart', handleTransactionStart);
          events.off('transactionProgress', handleTransactionProgress);

          // reset state
          if (!filesImportProgressListState.contents.show) {
            setSelf({
              importing: false,
              currentFileIndex: undefined,
              createNewFile: false,
              files: [],
            });
          }
        }
      });
    },
  ],
});
