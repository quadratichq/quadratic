import type { JsCellsA1Response } from '@/app/quadratic-core-types';

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

/** Response from core for async cell request */
export interface CorePythonGetCellsA1Response {
  type: 'corePythonGetCellsA1Response';
  requestId: number;
  response: JsCellsA1Response;
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

/** Async cell request (used when SharedArrayBuffer is not available) */
export interface PythonCoreGetCellsA1Async {
  type: 'pythonCoreGetCellsA1Async';
  requestId: number;
  transactionId: string;
  a1: string;
}

export type CorePythonMessage = CorePythonRun | CorePythonGetCellsA1Response;

export type PythonCoreMessage =
  | PythonCoreResults
  | PythonCoreGetCellsA1Length
  | PythonCoreGetCellsA1Data
  | PythonCoreGetCellsA1Async;
