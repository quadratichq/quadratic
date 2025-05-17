// this file cannot include any non-type imports; see https://rustwasm.github.io/wasm-bindgen/reference/js-snippets.html#caveats

import type {
  ConnectionKind,
  JsBordersSheet,
  JsHtmlOutput,
  JsOffset,
  JsRenderFill,
  JsSheetFill,
  JsSnackbarSeverity,
  SheetBounds,
  SheetInfo,
  TransactionName,
} from '@/app/quadratic-core-types';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    addUnsentTransaction: (transactionId: string, transaction: string, operations: number) => void;
    sendTransaction: (transactionId: string, operations: ArrayBufferLike) => void;
    sendImportProgress: (
      filename: string,
      current: number,
      total: number,
      x: number,
      y: number,
      width: number,
      height: number
    ) => void;
    sendHashRenderCellsRender: (hashRenderCells: Uint8Array) => void;
    sendAddSheetClient: (sheetInfo: SheetInfo, user: boolean) => void;
    sendDeleteSheetClient: (sheetId: string, user: boolean) => void;
    sendSheetInfoClient: (sheets: SheetInfo[]) => void;
    sendA1Context: (tableMap: string) => void;
    sendSheetInfoRender: (sheets: SheetInfo[]) => void;
    sendSheetFills: (sheetId: string, fill: JsRenderFill[]) => void;
    sendSheetMetaFills: (sheetId: string, fills: JsSheetFill) => void;
    sendBordersSheet: (sheetId: string, borders?: JsBordersSheet) => void;
    sendSheetInfoUpdateClient: (sheetInfo: SheetInfo) => void;
    sendSheetInfoUpdateRender: (sheetInfo: SheetInfo) => void;
    sendAddSheetRender: (sheetInfo: SheetInfo) => void;
    sendDeleteSheetRender: (sheetId: string) => void;
    sendSetCursor: (cursor: string) => void;
    requestTransactions: (sequenceNum: number) => void;
    sendSheetOffsetsClient: (sheetId: string, offsets: JsOffset[]) => void;
    sendSheetOffsetsRender: (sheetId: string, offsets: JsOffset[]) => void;
    sendSheetHtml: (html: JsHtmlOutput[]) => void;
    sendUpdateHtml: (html: JsHtmlOutput) => void;
    sendGenerateThumbnail: () => void;
    sendSheetCodeCells: (sheetId: string, renderCodeCells: Uint8Array) => void;
    sendSheetBoundsUpdateClient: (sheetBounds: SheetBounds) => void;
    sendSheetBoundsUpdateRender: (sheetBounds: SheetBounds) => void;
    sendTransactionStartClient: (transactionId: string, transactionName: TransactionName) => void;
    sendTransactionStartRender: (transactionId: string, transactionName: TransactionName) => void;
    sendTransactionProgress: (transactionId: string, remainingOperations: number) => void;
    sendTransactionEndClient: (transactionId: string, transactionName: TransactionName) => void;
    sendTransactionEndRender: (transactionId: string, transactionName: TransactionName) => void;
    sendRunPython: (transactionId: string, x: number, y: number, sheetId: string, code: string) => void;
    sendRunJavascript: (transactionId: string, x: number, y: number, sheetId: string, code: string) => void;
    sendUpdateCodeCells: (updateCodeCells: Uint8Array) => void;
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
    sendSheetValidations: (sheetId: string, sheetValidations: Uint8Array) => void;
    sendValidationWarnings: (warnings: Uint8Array) => void;
    sendRequestRowHeights: (transactionId: string, sheetId: string, rows: string) => void;
    sendMultiplayerSynced: () => void;
    sendHashesDirtyRender: (dirtyHashes: Uint8Array) => void;
    sendViewportBuffer: (buffer: SharedArrayBuffer) => void;
    sendClientMessage: (message: string, severity: JsSnackbarSeverity) => void;
  };

export const addUnsentTransaction = (transactionId: string, transactions: string, operations: number) => {
  return self.addUnsentTransaction(transactionId, transactions, operations);
};

export const jsSendTransaction = (transactionId: string, operations: Uint8Array) => {
  return self.sendTransaction(transactionId, operations.buffer);
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

export const jsHashesRenderCells = (render_cells: Uint8Array) => {
  self.sendHashRenderCellsRender(render_cells);
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

export const jsSheetFills = (sheetId: string, fills: string) => {
  const sheetFills = JSON.parse(fills);
  self.sendSheetFills(sheetId, sheetFills);
};

export const jsSheetMetaFills = (sheetId: string, sheetMetaFillsStringified: string) => {
  const sheetMetaFills = JSON.parse(sheetMetaFillsStringified) as JsSheetFill;
  self.sendSheetMetaFills(sheetId, sheetMetaFills);
};

export const jsSheetInfoUpdate = (sheetInfoStringified: string) => {
  const sheetInfo = JSON.parse(sheetInfoStringified);
  self.sendSheetInfoUpdateClient(sheetInfo);
  self.sendSheetInfoUpdateRender(sheetInfo);
};

export const jsOffsetsModified = (sheetId: string, offsetsStringified: string) => {
  const offsets = JSON.parse(offsetsStringified) as JsOffset[];
  self.sendSheetOffsetsClient(sheetId, offsets);
  self.sendSheetOffsetsRender(sheetId, offsets);
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

export const jsGenerateThumbnail = () => {
  self.sendGenerateThumbnail();
};

export const jsBordersSheet = (sheetId: string, bordersStringified: string) => {
  if (bordersStringified) {
    const borders = JSON.parse(bordersStringified) as JsBordersSheet;
    self.sendBordersSheet(sheetId, borders);
  } else {
    self.sendBordersSheet(sheetId, undefined);
  }
};

export const jsSheetCodeCells = (sheetId: string, renderCodeCells: Uint8Array) => {
  self.sendSheetCodeCells(sheetId, renderCodeCells);
};

export const jsSheetBoundsUpdate = (bounds: string) => {
  const sheetBounds = JSON.parse(bounds) as SheetBounds;
  self.sendSheetBoundsUpdateClient(sheetBounds);
  self.sendSheetBoundsUpdateRender(sheetBounds);
};

export const jsTransactionStart = (transaction_id: string, transaction_name: string) => {
  const transactionName = JSON.parse(transaction_name);
  self.sendTransactionStartClient(transaction_id, transactionName);
  self.sendTransactionStartRender(transaction_id, transactionName);
};

export const jsTransactionProgress = (transactionId: string, remainingOperations: number) => {
  self.sendTransactionProgress(transactionId, remainingOperations);
};

export const jsTransactionEnd = (transaction_id: string, transaction_name: string) => {
  const transactionName = JSON.parse(transaction_name);
  self.sendTransactionEndClient(transaction_id, transactionName);
  self.sendTransactionEndRender(transaction_id, transactionName);
};

export const jsRunPython = (transactionId: string, x: number, y: number, sheetId: string, code: string) => {
  self.sendRunPython(transactionId, x, y, sheetId, code);
};

export const jsRunJavascript = (transactionId: string, x: number, y: number, sheetId: string, code: string) => {
  self.sendRunJavascript(transactionId, x, y, sheetId, code);
};

export const jsUpdateCodeCells = (updateCodeCells: Uint8Array) => {
  self.sendUpdateCodeCells(updateCodeCells);
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

export const jsSheetValidations = (sheetId: string, sheetValidations: Uint8Array) => {
  self.sendSheetValidations(sheetId, sheetValidations);
};

export const jsValidationWarnings = (warnings: Uint8Array) => {
  self.sendValidationWarnings(warnings);
};

export const jsRequestRowHeights = (transactionId: string, sheetId: string, rows: string) => {
  self.sendRequestRowHeights(transactionId, sheetId, rows);
};

export const jsMultiplayerSynced = () => {
  self.sendMultiplayerSynced();
};

export const jsHashesDirty = (dirtyHashes: Uint8Array) => {
  self.sendHashesDirtyRender(dirtyHashes);
};

export const jsClientMessage = (message: string, severity: JsSnackbarSeverity) => {
  self.sendClientMessage(message, severity);
};

export const jsSendViewportBuffer = (buffer: SharedArrayBuffer) => {
  self.sendViewportBuffer(buffer);
};

export const jsA1Context = (context: string) => {
  self.sendA1Context(context);
};
