export interface PythonClientLoadError {
  type: 'pythonClientLoadError';
  error?: string;
}

export interface PythonClientState {
  type: 'pythonClientState';
  state: 'loading' | 'ready' | 'error' | 'running';

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

export interface PythonClientCaptureChartImage {
  type: 'pythonClientCaptureChartImage';
  id: number;
  html: string;
  width: number;
  height: number;
}

export interface ClientPythonChartImage {
  type: 'clientPythonChartImage';
  id: number;
  image: string | null;
}

export type PythonClientMessage =
  | PythonClientLoadError
  | PythonClientState
  | PythonClientInit
  | PythonClientGetJwt
  | PythonClientCaptureChartImage;

export type ClientPythonMessage =
  | ClientPythonInit
  | ClientPythonCoreChannel
  | ClientPythonGetJwt
  | ClientPythonChartImage;
