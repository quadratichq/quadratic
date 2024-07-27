// this file cannot include any non-type imports; see https://rustwasm.github.io/wasm-bindgen/reference/js-snippets.html#caveats

import type {
  ConnectionKind,
  JsCodeCell,
  JsHtmlOutput,
  JsRenderBorders,
  JsRenderCodeCell,
  JsRenderFill,
  JsSheetFill,
  Selection,
  SheetBounds,
  SheetInfo,
  TransactionName,
} from '@/app/quadratic-core-types';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    addUnsentTransaction: (transactionId: string, transaction: string, operations: number) => void;
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
    sendSheetMetaFills: (sheetId: string, fills: JsSheetFill) => void;
    sendSheetBorders: (sheetId: string, borders: JsRenderBorders) => void;
    sheetInfoUpdate: (sheetInfo: SheetInfo) => void;
    sendSheetInfoUpdateRender: (sheetInfo: SheetInfo) => void;
    sendAddSheetRender: (sheetInfo: SheetInfo) => void;
    sendDeleteSheetRender: (sheetId: string) => void;
    sendSetCursor: (cursor: string) => void;
    sendSetCursorSelection: (selection: Selection) => void;
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
    sendGenerateThumbnail: () => void;
    sendSheetCodeCell: (sheetId: string, codeCells: JsRenderCodeCell[]) => void;
    sendSheetBoundsUpdateClient: (sheetBounds: SheetBounds) => void;
    sendSheetBoundsUpdateRender: (sheetBounds: SheetBounds) => void;
    sendTransactionStart: (transactionId: string, transactionType: TransactionName) => void;
    sendTransactionProgress: (transactionId: String, remainingOperations: number) => void;
    sendRunPython: (transactionId: string, x: number, y: number, sheetId: string, code: string) => void;
    sendRunJavascript: (transactionId: string, x: number, y: number, sheetId: string, code: string) => void;
    sendUpdateCodeCell: (
      sheetId: string,
      x: number,
      y: number,
      codeCell?: JsCodeCell,
      renderCodeCell?: JsRenderCodeCell
    ) => void;
    sendUndoRedo: (undo: string, redo: string) => void;
    sendConnection: (
      transactionId: string,
      x: number,
      y: number,
      sheetId: string,
      code: string,
      connector_type: ConnectionKind,
      connection_id: String
    ) => void;
    sendImage: (sheetId: string, x: number, y: number, image?: string, w?: string, h?: string) => void;
  };

export const addUnsentTransaction = (transactionId: string, transactions: string, operations: number) => {
  return self.addUnsentTransaction(transactionId, transactions, operations);
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
  self.sendSheetInfoUpdateRender(sheetInfo);
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

export const jsSetCursorSelection = (selectionStringified: string) => {
  const selection = JSON.parse(selectionStringified) as Selection;
  self.sendSetCursorSelection(selection);
};

export const jsHtmlOutput = (htmlStringified: string) => {
  const html: JsHtmlOutput[] = JSON.parse(htmlStringified);
  self.sendSheetHtml(html);
};

export const jsGenerateThumbnail = () => {
  self.sendGenerateThumbnail();
};

export const jsSheetBorders = (sheetId: string, bordersStringified: string) => {
  const borders = JSON.parse(bordersStringified) as JsRenderBorders;
  self.sendSheetBorders(sheetId, borders);
};

export const jsSheetCodeCell = (sheetId: string, codeCellsStringified: string) => {
  const codeCells = JSON.parse(codeCellsStringified) as JsRenderCodeCell[];
  self.sendSheetCodeCell(sheetId, codeCells);
};

export const jsSheetBoundsUpdate = (bounds: string) => {
  const sheetBounds = JSON.parse(bounds) as SheetBounds;
  self.sendSheetBoundsUpdateClient(sheetBounds);
  self.sendSheetBoundsUpdateRender(sheetBounds);
};

export const jsTransactionStart = (transaction_id: string, transaction_name: string) => {
  const transactionType = JSON.parse(transaction_name);
  self.sendTransactionStart(transaction_id, transactionType);
};

export const jsTransactionProgress = (transactionId: String, remainingOperations: number) => {
  self.sendTransactionProgress(transactionId, remainingOperations);
};

export const jsRunPython = (transactionId: string, x: number, y: number, sheetId: string, code: string) => {
  self.sendRunPython(transactionId, x, y, sheetId, code);
};

export const jsRunJavascript = (transactionId: string, x: number, y: number, sheetId: string, code: string) => {
  self.sendRunJavascript(transactionId, x, y, sheetId, code);
};

export const jsUpdateCodeCell = (
  sheetId: string,
  x: bigint,
  y: bigint,
  codeCellStringified?: string,
  renderCodeCellStringified?: string
) => {
  if (codeCellStringified && renderCodeCellStringified) {
    const codeCell = JSON.parse(codeCellStringified) as JsCodeCell;
    const renderCodeCell = JSON.parse(renderCodeCellStringified) as JsRenderCodeCell;
    self.sendUpdateCodeCell(sheetId, Number(x), Number(y), codeCell, renderCodeCell);
  } else {
    self.sendUpdateCodeCell(sheetId, Number(x), Number(y));
  }
};

export const jsUndoRedo = (undo: string, redo: string) => {
  self.sendUndoRedo(undo, redo);
};

export const jsConnection = (
  transactionId: string,
  x: number,
  y: number,
  sheetId: string,
  code: string,
  connector_type: ConnectionKind,
  connection_id: String
) => {
  self.sendConnection(transactionId, x, y, sheetId, code, connector_type, connection_id);
};

export const jsSendImage = (sheetId: string, x: number, y: number, image?: string, w?: string, h?: string) => {
  self.sendImage(sheetId, x, y, image, w, h);
};

export const jsSheetMetaFills = (sheetId: string, sheetMetaFillsStringified: string) => {
  const sheetMetaFills = JSON.parse(sheetMetaFillsStringified) as JsSheetFill;
  self.sendSheetMetaFills(sheetId, sheetMetaFills);
};
