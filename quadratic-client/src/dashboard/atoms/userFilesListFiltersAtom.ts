import { atom } from 'jotai';

export type UserFilesListType = null | 'team' | 'private' | 'shared';

export type UserFilesListFilters = {
  fileName: string;
  fileType: UserFilesListType;
  fileCreator: null | string;
  sharedPublicly?: boolean;
  hasScheduledTasks?: boolean;
};

// Helper to get initial fileType from URL search params
function getInitialFileType(): UserFilesListType {
  try {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    if (type === 'team' || type === 'private' || type === 'shared') return type;
    return null;
  } catch {
    return null;
  }
}

export const defaultUserFilesListFilters: UserFilesListFilters = {
  fileName: '',
  fileType: getInitialFileType(),
  fileCreator: null,
  sharedPublicly: false,
};

export const userFilesListFiltersAtom = atom<UserFilesListFilters>(defaultUserFilesListFilters);
