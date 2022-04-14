import { atom } from 'recoil';

export const zoomStateAtom = atom({
  key: 'zoomState', // unique ID (with respect to other atoms/selectors)
  default: 1.0,
});
