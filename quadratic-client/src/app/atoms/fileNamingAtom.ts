import { atom } from 'recoil';

/**
 * Atom to track if the user has manually renamed the file.
 * If true, AI file naming should not be triggered for this file.
 */
export const fileManuallyRenamedAtom = atom<boolean>({
  key: 'fileManuallyRenamedAtom',
  default: false,
});
