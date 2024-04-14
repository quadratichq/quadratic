import { JsGetCellResponse } from '@/quadratic-core-types';
import { PythonRun } from './pythonTypes';

export interface CorePythonRun {
  type: 'corePythonRun';
  transactionId: string;
  sheetId: string;
  sheetName: string;
  x: number;
  y: number;
  code: string;
}

export interface PythonCoreResults {
  type: 'pythonCoreResults';
  transactionId: string;
  results: PythonRun;
}

export interface PythonCoreGetCells {
  type: 'pythonCoreGetCells';
  id: number;
  transactionId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sheet?: string;
  lineNumber?: number;
}

export interface CorePythonGetCells {
  type: 'corePythonGetCells';
  id: number;
  cells?: JsGetCellResponse[];
}

export type CorePythonMessage = CorePythonRun | CorePythonGetCells;

export type PythonCoreMessage = PythonCoreResults | PythonCoreGetCells;
