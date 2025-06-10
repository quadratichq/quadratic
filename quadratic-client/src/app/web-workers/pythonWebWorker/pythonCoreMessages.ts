export interface CorePythonRun {
  type: 'corePythonRun';
  transactionId: string;
  sheetId: string;
  x: number;
  y: number;
  code: string;
}

export interface PythonCoreResults {
  type: 'pythonCoreResults';
  transactionId: string;
  jsCodeResultBuffer: ArrayBuffer;
}

export interface PythonCoreGetCellsA1 {
  type: 'pythonCoreGetCellsA1';
  sharedBuffer: SharedArrayBuffer;
  transactionId: string;
  a1: string;
}

export type CorePythonMessage = CorePythonRun;

export type PythonCoreMessage = PythonCoreResults | PythonCoreGetCellsA1;
