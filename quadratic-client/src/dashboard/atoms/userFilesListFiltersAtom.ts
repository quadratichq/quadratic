import { atom } from 'jotai';

export type UserFilesListType = null | 'team' | 'private' | 'shared';

export type UserFilesListFilters = {
  fileName: string;
  fileType: UserFilesListType;
  fileCreatorEmails: string[];
  sharedPublicly: boolean;
  hasScheduledTasks: boolean;
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
  fileCreatorEmails: [],
  sharedPublicly: false,
  hasScheduledTasks: false,
};

export const userFilesListFiltersAtom = atom<UserFilesListFilters>(defaultUserFilesListFilters);

// Derived atom that checks if "other filters" (dropdown filters) are active
export const hasFiltersAppliedAtom = atom((get) => {
  const filters = get(userFilesListFiltersAtom);
  return filters.hasScheduledTasks || filters.sharedPublicly || filters.fileCreatorEmails.length > 0;
});
