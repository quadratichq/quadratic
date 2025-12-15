import { atom } from 'jotai';

export type FilesListFilters = {
  fileName: string;
  fileType: '' | 'team' | 'private' | 'shared';
  fileCreator: null | string;
  sharedPublicly?: boolean;
  hasScheduledTasks?: boolean;
};

export const defaultFilesListFilters: FilesListFilters = {
  fileName: '',
  fileType: '',
  fileCreator: null,
  sharedPublicly: false,
};

export const filesListFiltersAtom = atom<FilesListFilters>(defaultFilesListFilters);
