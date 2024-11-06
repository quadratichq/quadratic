// Messages sent between the javascript web worker and the javascript runner
// (which is where the user code is executed).

import { CellType } from './javascriptAPI';

export type JavascriptRunnerGetCells = CellType[][] | undefined;

export interface RunnerJavascriptGetCellsLength {
  type: 'getCellsLength';
  sharedBuffer: SharedArrayBuffer;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  sheetName?: string;
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
  chartPixelOutput?: [number, number];
}

export interface RunnerJavascriptError {
  type: 'error';
  error: string;
  stack: string;
  console: string;
}

export type RunnerJavascriptMessage =
  | RunnerJavascriptGetCellsLength
  | RunnerJavascriptGetCellsData
  | RunnerJavascriptResults
  | RunnerJavascriptError;
