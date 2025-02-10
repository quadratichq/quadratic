import type { JsCodeResult, JsGetCellResponse } from '@/app/quadratic-core-types';

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
  results: JsCodeResult;
}

export interface CoreJavascriptGetCellsA1 {
  type: 'coreJavascriptGetCellsA1';
  id: number;
  cells?: JsGetCellResponse[];
  // returned by GetCellsA1
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  two_dimensional?: boolean;
}

export interface JavascriptCoreGetCellsA1 {
  type: 'javascriptCoreGetCellsA1';
  id: number;
  transactionId: string;
  a1: string;
  lineNumber?: number;
}

export type CoreJavascriptMessage = CoreJavascriptRun | CoreJavascriptGetCellsA1;

export type JavascriptCoreMessage = JavascriptCoreResults | JavascriptCoreGetCellsA1;
