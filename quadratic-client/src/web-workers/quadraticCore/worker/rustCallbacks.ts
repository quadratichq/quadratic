// this file cannot include any imports; see https://rustwasm.github.io/wasm-bindgen/reference/js-snippets.html#caveats

import { SheetInfo } from '@/quadratic-core-types';

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
    sendAddSheet: (sheetId: string, name: string, order: string, user: boolean) => void;
    sendSheetInfoClient: (sheets: SheetInfo[]) => void;
    sendSheetInfoRender: (sheets: SheetInfo[]) => void;
  };

export const runPython = (transactionId: string, x: number, y: number, sheetId: string, code: string): void => {
  console.log('TODO: runPython');
  // return self.runPython(transactionId, x, y, sheetId, code);
};

export const addUnsentTransaction = (transactionId: string, operations: string) => {
  // todo...
  // return self.addTransaction(transactionId, operations);
};

export const sendTransaction = (transactionId: string, operations: string) => {
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

export const jsAddSheet = (sheetId: string, name: string, order: string, user: boolean) => {
  self.sendAddSheet(sheetId, name, order, user);
};

export const jsSheetInfo = (sheetInfoStringified: string) => {
  const sheetInfo = JSON.parse(sheetInfoStringified);
  self.sendSheetInfoClient(sheetInfo);
  self.sendSheetInfoRender(sheetInfo);
};
