import { PythonReturnType } from './pythonTypes';

export interface CorePythonRun {
  type: 'corePythonRun';
  transactionId: number;
  sheetId: string;
  x: number;
  y: number;
  code: string;
}

export interface PythonCoreCalculationComplete {
  type: 'pythonCoreCalculationComplete';
}

export interface PythonCoreResults {
  type: 'pythonCoreResults';
  transactionId: number;
  results: PythonReturnType;
}

export type CorePythonMessage = CorePythonRun;

export type PythonCoreMessage = PythonCoreCalculationComplete;
