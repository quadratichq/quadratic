import { SheetPosTS } from '@/gridGL/types/size';
import { CorePythonRun } from './pythonCoreMessages';

export interface PythonClientLoadError {
  type: 'pythonClientLoadError';
  error?: string;
}

export type PythonStateType = 'loading' | 'ready' | 'error' | 'running';

export interface PythonCodeRun {
  transactionId: string;
  sheetPos: SheetPosTS;
  code: string;
}

export interface PythonClientState {
  type: 'pythonClientState';
  state: 'loading' | 'ready' | 'error' | 'running';

  // current cell being executed
  current?: CorePythonRun;

  // cells awaiting execution
  awaitingExecution?: CorePythonRun[];

  // error loading Python
  error?: string;

  // used on initial load to set Python version
  version?: string;
}

export interface ClientPythonCoreChannel {
  type: 'clientPythonCoreChannel';
}

export type PythonClientMessage = PythonClientLoadError | PythonClientState;

export type ClientPythonMessage = ClientPythonCoreChannel;
