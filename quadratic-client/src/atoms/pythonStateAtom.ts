import { PythonStateType } from '@/web-workers/pythonWebWorker/pythonClientMessages';
import { atom } from 'recoil';

export interface PythonState {
  pythonState: PythonStateType;
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
