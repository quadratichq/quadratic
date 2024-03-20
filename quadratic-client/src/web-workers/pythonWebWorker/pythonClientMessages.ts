export interface PythonClientLoadError {
  type: 'pythonClientLoadError';
  error?: string;
}

export interface PythonClientLoaded {
  type: 'pythonClientLoaded';
  version: string;
}

export interface ClientPythonCoreChannel {
  type: 'clientPythonCoreChannel';
}

export type PythonClientMessage = PythonClientLoadError | PythonClientLoaded;

export type ClientPythonMessage = ClientPythonCoreChannel;
