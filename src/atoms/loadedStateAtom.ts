import { atom } from 'recoil';

export interface LoadedState {
  pythonLoaded: boolean;
}

export const loadedStateDefault: LoadedState = {
  pythonLoaded: false,
};

export const loadedStateAtom = atom({
  key: 'loadedState',
  default: loadedStateDefault,
});
