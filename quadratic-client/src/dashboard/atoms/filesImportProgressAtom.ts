import { events } from '@/app/events/events';
import {
  CoreClientImportProgress,
  CoreClientTransactionProgress,
  CoreClientTransactionStart,
} from '@/app/web-workers/quadraticCore/coreClientMessages';
import { atom, DefaultValue } from 'recoil';

export interface FileImportProgress {
  name: string;
  size: number;
  step: 'read' | 'create' | 'save' | 'done' | 'error' | 'cancel';
  progress: number; // read input file
  transactionId?: string;
  transactionOps?: number;
}

interface FilesImportProgressState {
  importing: boolean;
  createNewFile: boolean;
  currentFileIndex: number;
  files: FileImportProgress[];
}

const defaultFilesImportProgressState: FilesImportProgressState = {
  importing: false,
  createNewFile: false,
  currentFileIndex: 0,
  files: [],
};

export const filesImportProgressAtom = atom({
  key: 'filesImportProgress',
  default: defaultFilesImportProgressState,
  effects: [
    ({ onSet, setSelf }) => {
      onSet((newValue, oldValue) => {
        if (oldValue instanceof DefaultValue) return;

        const handleImportProgress = (message: CoreClientImportProgress) => {
          setSelf((prev) => {
            if (prev instanceof DefaultValue) return prev;
            const updatedFiles = prev.files.map((file, index) => {
              if (index !== prev.currentFileIndex) return file;
              const newFile: FileImportProgress = {
                name: file.name,
                size: file.size,
                step: 'read',
                progress: Math.round((message.current / message.total) * 100) / 3,
                transactionId: file.transactionId,
                transactionOps: file.transactionOps,
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
                  name: file.name,
                  size: file.size,
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
                name: file.name,
                size: file.size,
                step: 'create',
                progress,
                transactionId: file.transactionId,
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
          // reset state
          setSelf({
            importing: false,
            currentFileIndex: 0,
            createNewFile: false,
            files: [],
          });

          // remove event listeners
          events.off('importProgress', handleImportProgress);
          events.off('transactionStart', handleTransactionStart);
          events.off('transactionProgress', handleTransactionProgress);
        }
      });
    },
  ],
});
