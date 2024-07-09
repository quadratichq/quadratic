import type { CodeRun } from '@/app/web-workers/CodeRun';

export interface PythonClientLoadError {
  type: 'pythonClientLoadError';
  error?: string;
}

export interface PythonClientState {
  type: 'pythonClientState';
  state: 'loading' | 'ready' | 'error' | 'running';

  // current cell being executed
  current?: CodeRun;

  // cells awaiting execution
  awaitingExecution?: CodeRun[];

  // error loading Python
  error?: string;

  // used on initial load to set Python version
  version?: string;
}

export interface ClientPythonCoreChannel {
  type: 'clientPythonCoreChannel';
}

export interface ClientPythonInit {
  type: 'clientPythonInit';
  env: ImportMetaEnv;
}

export interface PythonClientInit {
  type: 'pythonClientInit';
  version: string;
}

export interface ClientPythonGetJwt {
  type: 'clientPythonGetJwt';
  id: number;
  jwt: string;
}

export interface PythonClientGetJwt {
  type: 'pythonClientGetJwt';
  id: number;
}

export type PythonClientMessage = PythonClientLoadError | PythonClientState | PythonClientInit | PythonClientGetJwt;

export type ClientPythonMessage = ClientPythonInit | ClientPythonCoreChannel | ClientPythonGetJwt;
