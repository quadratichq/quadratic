import { JsCodeResult } from '@/quadratic-core-types';
import { PythonRun } from './pythonTypes';

export interface CorePythonRun {
  type: 'corePythonRun';
  transactionId: string;
  sheetId: string;
  x: number;
  y: number;
  code: string;
}

export interface PythonCoreCalculationComplete {
  type: 'pythonCoreCalculationComplete';
  result: JsCodeResult;
}

export interface PythonCoreResults {
  type: 'pythonCoreResults';
  transactionId: string;
  results: PythonRun;
}

export type CorePythonMessage = CorePythonRun;

export type PythonCoreMessage = PythonCoreCalculationComplete | PythonCoreResults;
