// Messages sent between the javascript web worker and the javascript runner
// (which is where the user code is executed).

import { CellType } from './javascriptAPI';

export type JavascriptRunnerGetCells = CellType[][] | undefined;

export interface RunnerJavascriptGetCellsA1Length {
  type: 'getCellsA1Length';
  sharedBuffer: SharedArrayBuffer;
  a1: string;
}

export interface RunnerJavascriptGetCellsData {
  type: 'getCellsData';
  id: number;
  sharedBuffer: SharedArrayBuffer;
}

export interface RunnerJavascriptResults {
  type: 'results';
  results: any;
  console: string;
  lineNumber?: number;
}

export interface RunnerJavascriptError {
  type: 'error';
  error: string;
  stack: string;
  console: string;
}

export type RunnerJavascriptMessage =
  | RunnerJavascriptGetCellsA1Length
  | RunnerJavascriptGetCellsData
  | RunnerJavascriptResults
  | RunnerJavascriptError;
