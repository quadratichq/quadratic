import { atom } from 'jotai';

export type FilesListType = null | 'team' | 'private' | 'shared';

export type FilesListFilters = {
  fileName: string;
  fileType: FilesListType;
  fileCreator: null | string;
  sharedPublicly?: boolean;
  hasScheduledTasks?: boolean;
};

// Helper to get initial fileType from URL search params
function getInitialFileType(): FilesListType {
  try {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    if (type === 'team' || type === 'private' || type === 'shared') return type;
    return null;
  } catch {
    return null;
  }
}

export const defaultFilesListFilters: FilesListFilters = {
  fileName: '',
  fileType: getInitialFileType(),
  fileCreator: null,
  sharedPublicly: false,
};

export const filesListFiltersAtom = atom<FilesListFilters>(defaultFilesListFilters);
