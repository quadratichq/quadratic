import { atom } from 'recoil';

export const showCSVImportHelpAtom = atom({
  key: 'showCSVImportHelpState', // unique ID (with respect to other atoms/selectors)
  default: false,
});
