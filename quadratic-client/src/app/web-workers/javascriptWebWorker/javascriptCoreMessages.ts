import { JsCodeResult, JsGetCellResponse } from '@/app/quadratic-core-types';

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

export interface JavascriptCoreGetCells {
  type: 'javascriptCoreGetCells';
  id: number;
  transactionId: string;
  x: number;
  y: number;
  w: number;
  h?: number;
  sheet?: string;
  lineNumber?: number;
}

export interface CoreJavascriptGetCells {
  type: 'coreJavascriptGetCells';
  id: number;
  cells?: JsGetCellResponse[];
  // returned by GetA1Cells
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface JavascriptCoreGetA1Cells {
  type: 'javascriptCoreGetA1Cells';
  id: number;
  transactionId: string;
  a1: string;
  lineNumber?: number;
}

export type CoreJavascriptMessage = CoreJavascriptRun | CoreJavascriptGetCells;

export type JavascriptCoreMessage = JavascriptCoreResults | JavascriptCoreGetCells | JavascriptCoreGetA1Cells;
