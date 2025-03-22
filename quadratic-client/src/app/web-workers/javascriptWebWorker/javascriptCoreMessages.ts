export interface CoreJavascriptRun {
  type: 'coreJavascriptRun';
  transactionId: string;
  sheetId: string;
  x: number;
  y: number;
  code: string;
}

export interface JavascriptCoreResults {
  type: 'javascriptCoreResults';
  transactionId: string;
  // ArrayBuffer of stringified JsCodeResult
  jsCodeResultBuffer: ArrayBuffer;
}

export interface CoreJavascriptGetCellsA1 {
  type: 'coreJavascriptGetCellsA1';
  id: number;
  // ArrayBuffer of stringified JsCellsA1Response
  cellsA1ResponseBuffer: ArrayBuffer;
}

export interface JavascriptCoreGetCellsA1 {
  type: 'javascriptCoreGetCellsA1';
  id: number;
  transactionId: string;
  a1: string;
}

export type CoreJavascriptMessage = CoreJavascriptRun | CoreJavascriptGetCellsA1;

export type JavascriptCoreMessage = JavascriptCoreResults | JavascriptCoreGetCellsA1;
