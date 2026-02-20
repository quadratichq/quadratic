import { atom } from 'recoil';

export type ConnectionPickerMode = false | 'query' | 'prompt' | 'manage';

export const connectionPickerModeAtom = atom<ConnectionPickerMode>({
  key: 'connectionPickerMode',
  default: false,
});
