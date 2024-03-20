import { atom } from 'recoil';

export interface PythonState {
  pythonState: 'loading' | 'idle' | 'error' | 'running';
  version: string;
}

export const pythonStateDefault: PythonState = {
  pythonState: 'loading',
  version: '3.11.3',
};

export const pythonStateAtom = atom({
  key: 'loadedState',
  default: pythonStateDefault,
});
