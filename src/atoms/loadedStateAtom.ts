import { atom } from 'recoil';

export interface LoadedState {
  pythonLoadState: 'initial' | 'loading' | 'loaded' | 'error';
}

export const loadedStateDefault: LoadedState = {
  pythonLoadState: 'initial',
};

export const loadedStateAtom = atom({
  key: 'loadedState',
  default: loadedStateDefault,
});
