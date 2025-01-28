import type { PythonRun } from '@/app/web-workers/pythonWebWorker/pythonTypes';

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
  results: PythonRun;
}

export interface PythonCoreGetCellsA1Length {
  type: 'pythonCoreGetCellsA1Length';
  sharedBuffer: SharedArrayBuffer;
  transactionId: string;
  a1: string;
  lineNumber?: number;
}

export interface PythonCoreGetCellsA1Data {
  type: 'pythonCoreGetCellsA1Data';
  id: number;
  sharedBuffer: SharedArrayBuffer;
}

export type CorePythonMessage = CorePythonRun;

export type PythonCoreMessage = PythonCoreResults | PythonCoreGetCellsA1Length | PythonCoreGetCellsA1Data;
