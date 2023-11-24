import { atom } from 'recoil';

export interface PythonState {
  pythonState: 'initial' | 'loading' | 'idle' | 'error' | 'running';
}

export const pythonStateDefault: PythonState = {
  pythonState: 'initial',
};

export const pythonStateAtom = atom({
  key: 'loadedState',
  default: pythonStateDefault,
});
