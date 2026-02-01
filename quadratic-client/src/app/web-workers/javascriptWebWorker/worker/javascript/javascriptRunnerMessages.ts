// Messages sent between the javascript web worker and the javascript runner
// (which is where the user code is executed).

export interface RunnerJavascriptResults {
  type: 'results';
  results: any;
  console: string;
  lineNumber?: number;
  chartPixelOutput?: [number, number];
}

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

/** Async cell request (used when SharedArrayBuffer is not available) */
export interface RunnerJavascriptGetCellsA1Async {
  type: 'getCellsA1Async';
  requestId: number;
  a1: string;
}

export interface RunnerJavascriptError {
  type: 'error';
  error: string;
  stack: string;
  console: string;
}

export type RunnerJavascriptMessage =
  | RunnerJavascriptResults
  | RunnerJavascriptGetCellsA1Length
  | RunnerJavascriptGetCellsData
  | RunnerJavascriptGetCellsA1Async
  | RunnerJavascriptError;
