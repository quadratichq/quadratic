import { events } from '@/app/events/events';
import {
  CoreClientImportProgress,
  CoreClientTransactionProgress,
  CoreClientTransactionStart,
} from '@/app/web-workers/quadraticCore/coreClientMessages';
import { atom, DefaultValue, selector } from 'recoil';

interface FileImportProgressState {
  importing: boolean;
  saveRequired: boolean;
  totalFiles?: number;
  totalFilesSize?: number;
  remainingFiles?: number;
  remainingFilesSize?: number;
  currentFileName?: string;
  currentFileSize?: number;
  currentFileStep?: 'read' | 'create' | 'save';
  currentFileReadProgress?: number;
  currentFileCreateProgress?: number;
  currentFileTransactionId?: string;
  currentFileTransactionOps?: number;
}

const defaultFileImportProgressState: FileImportProgressState = {
  importing: false,
  saveRequired: false,
  totalFiles: undefined,
  totalFilesSize: undefined,
  remainingFiles: undefined,
  remainingFilesSize: undefined,
  currentFileName: undefined,
  currentFileSize: undefined,
  currentFileStep: undefined,
  currentFileReadProgress: undefined,
  currentFileCreateProgress: undefined,
  currentFileTransactionId: undefined,
  currentFileTransactionOps: undefined,
};

export const fileImportProgressAtom = atom({
  key: 'fileImportProgress',
  default: defaultFileImportProgressState,
  effects: [
    ({ onSet, setSelf }) => {
      onSet((newValue, oldValue) => {
        if (oldValue instanceof DefaultValue) return;

        const handleImportProgress = (message: CoreClientImportProgress) => {
          const currentFileReadProgress = Math.round((message.current / message.total) * 100);
          setSelf((prev) => {
            if (prev instanceof DefaultValue) return prev;
            return { ...prev, currentFileReadProgress, currentFileStep: 'read' };
          });
        };

        const handleTransactionStart = (message: CoreClientTransactionStart) => {
          if (message.transactionType === 'Import') {
            setSelf((prev) => {
              if (prev instanceof DefaultValue) return prev;
              return { ...prev, currentFileTransactionId: message.transactionId, currentFileStep: 'create' };
            });
          }
        };

        const handleTransactionProgress = (message: CoreClientTransactionProgress) => {
          setSelf((prev) => {
            if (prev instanceof DefaultValue || message.transactionId !== prev.currentFileTransactionId) return prev;
            const currentFileTransactionOps = Math.max(
              prev.currentFileTransactionOps || 0,
              message.remainingOperations
            );
            const currentFileCreateProgress = Math.round(
              (1 - message.remainingOperations / currentFileTransactionOps) * 100
            );
            return { ...prev, currentFileCreateProgress, currentFileTransactionOps, currentFileStep: 'create' };
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
            saveRequired: false,
            totalFiles: undefined,
            totalFilesSize: undefined,
            remainingFiles: undefined,
            remainingFilesSize: undefined,
            currentFileName: undefined,
            currentFileSize: undefined,
            currentFileReadProgress: undefined,
            currentFileCreateProgress: undefined,
            currentFileTransactionId: undefined,
            currentFileTransactionOps: undefined,
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

export const fileImportProgressSelector = selector({
  key: 'fileImportProgressSelector',
  get: ({ get }) => {
    const fileImportProgress = get(fileImportProgressAtom);
    const step = fileImportProgress.currentFileStep ?? 'read';
    const currentFileReadProgress = step === 'read' ? fileImportProgress.currentFileReadProgress ?? 0 : 100;
    const currentFileCreateProgress =
      step === 'read' || step === 'create' ? fileImportProgress.currentFileCreateProgress ?? 0 : 100;
    let currentFileProgress = (currentFileReadProgress + currentFileCreateProgress) / 2;
    currentFileProgress = Math.min(100, Math.max(0, currentFileProgress));

    const currentFileSize = fileImportProgress.currentFileSize ?? 0;
    const remainingFilesSize = fileImportProgress.remainingFilesSize ?? 1;
    const totalFilesSize = fileImportProgress.totalFilesSize ?? 1;
    let totalProgress =
      currentFileProgress * (currentFileSize / totalFilesSize) + (1 - remainingFilesSize / totalFilesSize) * 100;
    totalProgress = Math.min(100, Math.max(0, totalProgress));

    return {
      importing: fileImportProgress.importing,
      fileName: fileImportProgress.currentFileName ?? 'Untitled',
      currentFileProgress,
      totalProgress,
      totalFiles: fileImportProgress.totalFiles ?? 1,
      remainingFiles: fileImportProgress.remainingFiles ?? 1,
      currentFileStep: fileImportProgress.currentFileStep ?? 'read',
    };
  },
});
