import { apiClient } from '@/shared/api/apiClient';
import type { GlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { atom, getDefaultStore, useAtomValue } from 'jotai';

type FileLocation = {
  fileUuid: string;
  ownerUserId: number | null; // null = team file, number = personal file
};

/**
 * Atom that stores the current file's location (personal vs team).
 * Only used when in the app (not on dashboard)
 */
const fileLocationAtom = atom<FileLocation | null>(null);

/**
 * Hook to access file location. Only use in app context (not dashboard).
 * Throws if called when atom is not initialized.
 */
export const useFileLocation = () => {
  const location = useAtomValue(fileLocationAtom);
  if (!location) {
    throw new Error('useFileLocation must be used within file context (not on dashboard)');
  }
  return location;
};

/**
 * Initialize the file location from route loader data.
 * Call this when the file route loads.
 */
export const initFileLocation = (fileUuid: string, ownerUserId: number | null) => {
  getDefaultStore().set(fileLocationAtom, { fileUuid, ownerUserId });
};

/**
 * Clear the file location atom.
 * Call this when leaving the file route.
 */
export const clearFileLocation = () => {
  getDefaultStore().set(fileLocationAtom, null);
};

/**
 * Sync the file location from another source (e.g., ShareDialog).
 * Only updates if we're in app context (atom is initialized) and it's the same file.
 * Safe to call from dashboard - will just do nothing.
 */
export const syncFileLocation = (fileUuid: string, ownerUserId: number | null) => {
  const store = getDefaultStore();
  const current = store.get(fileLocationAtom);

  // Only sync if atom exists (we're in app context) and same file
  if (current && current.fileUuid === fileUuid) {
    store.set(fileLocationAtom, { fileUuid, ownerUserId });
  }
};

/**
 * Move a file between personal and team with optimistic update.
 * @param fileUuid - The file's UUID
 * @param newOwnerUserId - null for team file, user ID for personal file
 * @param addGlobalSnackbar - Snackbar function for displaying error messages
 */
export const moveFile = async (
  fileUuid: string,
  newOwnerUserId: number | null,
  addGlobalSnackbar: GlobalSnackbar['addGlobalSnackbar']
): Promise<boolean> => {
  const store = getDefaultStore();
  const prev = store.get(fileLocationAtom);

  // Optimistic update
  store.set(fileLocationAtom, { fileUuid, ownerUserId: newOwnerUserId });

  try {
    await apiClient.files.update(fileUuid, { ownerUserId: newOwnerUserId });
    return true;
  } catch (error) {
    // Revert on failure
    if (prev) {
      store.set(fileLocationAtom, prev);
    }
    addGlobalSnackbar('Failed to move file. Try again later.', { severity: 'error' });
    console.error('Failed to move file:', error);
    return false;
  }
};

/**
 * Get the current file location value (for use outside React components).
 */
export const getFileLocation = () => {
  return getDefaultStore().get(fileLocationAtom);
};
