import { atom } from 'jotai';

/** Set of file UUIDs currently selected in the dashboard file list. */
export const dashboardSelectedFileUuidsAtom = atom<Set<string>>(new Set<string>());
