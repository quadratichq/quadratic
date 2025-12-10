import { atom, getDefaultStore } from 'jotai';

export interface FileLimitDialogState {
  open: boolean;
  maxEditableFiles?: number;
  teamUuid?: string;
  onCreateAnyway?: () => void;
}

export const fileLimitDialogAtom = atom<FileLimitDialogState>({
  open: false,
});

/**
 * Show the file limit dialog with a callback for "Create anyway" action.
 */
export const showFileLimitDialog = (maxEditableFiles: number, teamUuid: string, onCreateAnyway: () => void) => {
  getDefaultStore().set(fileLimitDialogAtom, {
    open: true,
    maxEditableFiles,
    teamUuid,
    onCreateAnyway,
  });
};

/**
 * Close the file limit dialog.
 */
export const closeFileLimitDialog = () => {
  getDefaultStore().set(fileLimitDialogAtom, { open: false });
};
