// Messages sent between the javascript web worker and the javascript runner
// (which is where the user code is executed).

export interface RunnerJavascriptGetCellsA1 {
  type: 'getCellsA1';
  sharedBuffer: SharedArrayBuffer;
  a1: string;
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

export type RunnerJavascriptMessage = RunnerJavascriptGetCellsA1 | RunnerJavascriptResults | RunnerJavascriptError;
