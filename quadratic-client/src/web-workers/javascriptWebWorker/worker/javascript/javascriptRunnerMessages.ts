// Messages sent between the javascript web worker and the javascript runner
// (which is where the user code is executed).

import { CellType } from './javascriptAPI';

export type JavascriptRunnerGetCells = CellType[][] | undefined;

export interface RunnerJavascriptGetCell {
  type: 'getCells';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  sheetName?: string;
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

export type JavascriptRunnerMessage = JavascriptRunnerGetCells;

export type RunnerJavascriptMessage = RunnerJavascriptGetCell | RunnerJavascriptResults | RunnerJavascriptError;
