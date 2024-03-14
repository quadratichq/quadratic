// this file cannot include any non-type imports; see https://rustwasm.github.io/wasm-bindgen/reference/js-snippets.html#caveats

import { JsHtmlOutput, JsRenderFill, SheetInfo } from '@/quadratic-core-types';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    runPython: (transactionId: string, x: number, y: number, sheetId: string, code: string) => void;
    addTransaction: (transactionId: string, operations: string) => void;
    sendTransaction: (transactionId: string, operations: string) => void;
    sendImportProgress: (
      filename: string,
      current: number,
      total: number,
      x: number,
      y: number,
      width: number,
      height: number
    ) => void;
    sendCompleteRenderCells: (sheetId: string, hashX: number, hashY: number, cells: string) => void;
    sendAddSheetClient: (sheetInfo: SheetInfo, user: boolean) => void;
    sendDeleteSheetClient: (sheetId: string, user: boolean) => void;
    sendSheetInfoClient: (sheets: SheetInfo[]) => void;
    sendSheetInfoRender: (sheets: SheetInfo[]) => void;
    sendSheetFills: (sheetId: string, fill: JsRenderFill[]) => void;
    sheetInfoUpdate: (sheetInfo: SheetInfo) => void;
    sendAddSheetRender: (sheetInfo: SheetInfo) => void;
    sendDeleteSheetRender: (sheetId: string) => void;
    sendSetCursor: (cursor: string) => void;
    requestTransactions: (sequenceNum: number) => void;
    sendSheetOffsetsClient: (
      sheetId: string,
      column: bigint | undefined,
      row: bigint | undefined,
      size: number
    ) => void;
    sendSheetOffsetsRender: (
      sheetId: string,
      column: bigint | undefined,
      row: bigint | undefined,
      size: number
    ) => void;
    sendSheetHtml: (html: JsHtmlOutput[]) => void;
    sendUpdateHtml: (html: JsHtmlOutput) => void;
  };

export const runPython = (transactionId: string, x: number, y: number, sheetId: string, code: string): void => {
  console.log('TODO: runPython');
  // return self.runPython(transactionId, x, y, sheetId, code);
};

export const addUnsentTransaction = (transactionId: string, operations: string) => {
  // todo...
  // return self.addTransaction(transactionId, operations);
};

export const jsSendTransaction = (transactionId: string, operations: string) => {
  return self.sendTransaction(transactionId, operations);
};

export const jsTime = (name: string) => console.time(name);
export const jsTimeEnd = (name: string) => console.timeEnd(name);

export const jsImportProgress = (
  filename: string,
  current: number,
  total: number,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  return self.sendImportProgress(filename, current, total, x, y, width, height);
};

export const jsRenderCellSheets = (sheetId: string, hashX: bigint, hashY: bigint, cells: string /*JsRenderCell[]*/) => {
  self.sendCompleteRenderCells(sheetId, Number(hashX), Number(hashY), cells);
};

export const jsAddSheet = (sheetInfoStringified: string, user: boolean) => {
  const sheetInfo = JSON.parse(sheetInfoStringified);
  self.sendAddSheetClient(sheetInfo, user);
  self.sendAddSheetRender(sheetInfo);
};

export const jsDeleteSheet = (sheetId: string, user: boolean) => {
  self.sendDeleteSheetClient(sheetId, user);
  self.sendDeleteSheetRender(sheetId);
};

export const jsSheetInfo = (sheetInfoStringified: string) => {
  const sheetInfo = JSON.parse(sheetInfoStringified);
  self.sendSheetInfoClient(sheetInfo);
  self.sendSheetInfoRender(sheetInfo);
};

export const jsSheetFills = (sheet_id: string, fills: string) => {
  const sheet_fills = JSON.parse(fills);
  self.sendSheetFills(sheet_id, sheet_fills);
};

export const jsSheetInfoUpdate = (sheetInfoStringified: string) => {
  const sheetInfo = JSON.parse(sheetInfoStringified);
  self.sheetInfoUpdate(sheetInfo);
};

export const jsOffsetsModified = (
  sheetId: string,
  column: bigint | undefined,
  row: bigint | undefined,
  size: number
) => {
  self.sendSheetOffsetsClient(sheetId, column, row, size);
  self.sendSheetOffsetsRender(sheetId, column, row, size);
};

export const jsUpdateHtml = (htmlStringified: string) => {
  const html: JsHtmlOutput = JSON.parse(htmlStringified);
  self.sendUpdateHtml(html);
};

export const jsRequestTransactions = (sequenceNum: bigint) => {
  self.requestTransactions(Number(sequenceNum));
};

export const jsSetCursor = (cursor: string) => {
  self.sendSetCursor(cursor);
};

export const jsHtmlOutput = (htmlStringified: string) => {
  const html: JsHtmlOutput[] = JSON.parse(htmlStringified);
  self.sendSheetHtml(html);
};
