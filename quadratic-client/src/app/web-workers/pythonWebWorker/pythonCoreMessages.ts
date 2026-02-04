export interface CorePythonRun {
  type: 'corePythonRun';
  transactionId: string;
  sheetId: string;
  x: number;
  y: number;
  code: string;
  chartPixelWidth: number;
  chartPixelHeight: number;
}

export interface PythonCoreResults {
  type: 'pythonCoreResults';
  jsCodeResultBuffer: ArrayBuffer;
}

export interface PythonCoreGetCellsA1Length {
  type: 'pythonCoreGetCellsA1Length';
  sharedBuffer: SharedArrayBuffer;
  transactionId: string;
  a1: string;
}

export interface PythonCoreGetCellsA1Data {
  type: 'pythonCoreGetCellsA1Data';
  id: number;
  sharedBuffer: SharedArrayBuffer;
}

export type CorePythonMessage = CorePythonRun;

export type PythonCoreMessage = PythonCoreResults | PythonCoreGetCellsA1Length | PythonCoreGetCellsA1Data;
