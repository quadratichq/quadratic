import { PythonRun } from './pythonTypes';

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

export interface PythonCoreGetCellsLength {
  type: 'pythonCoreGetCellsLength';
  sharedBuffer: SharedArrayBuffer;
  transactionId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sheet?: string;
  lineNumber?: number;
}

export interface PythonCoreGetCellsA1Length {
  type: 'pythonCoreGetCellsA1Length';
  sharedBuffer: SharedArrayBuffer;
  transactionId: string;
  a1: string;
  lineNumber?: number;
}

export interface PythonCoreGetCellsData {
  type: 'pythonCoreGetCellsData';
  id: number;
  sharedBuffer: SharedArrayBuffer;
}

export interface PythonCoreGetCellsA1Data {
  type: 'pythonCoreGetCellsA1Data';
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  sharedBuffer: SharedArrayBuffer;
}

export type CorePythonMessage = CorePythonRun;

export type PythonCoreMessage =
  | PythonCoreResults
  | PythonCoreGetCellsLength
  | PythonCoreGetCellsA1Length
  | PythonCoreGetCellsData
  | PythonCoreGetCellsA1Data;
