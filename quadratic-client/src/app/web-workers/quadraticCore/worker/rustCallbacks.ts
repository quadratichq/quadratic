// this file cannot include any non-type imports; see https://rustwasm.github.io/wasm-bindgen/reference/js-snippets.html#caveats

import type { ConnectionKind, JsSnackbarSeverity, TransactionName } from '@/app/quadratic-core-types';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    addUnsentTransaction: (transactionId: string, transaction: string, operations: number) => void;
    sendTransaction: (transactionId: string, operations: ArrayBufferLike) => void;
    sendImportProgress: (filename: string, current: number, total: number) => void;
    sendAddSheetClient: (sheetInfo: Uint8Array, user: boolean) => void;
    sendAddSheetRender: (sheetInfo: Uint8Array) => void;
    sendDeleteSheetClient: (sheetId: string, user: boolean) => void;
    sendSheetsInfoClient: (sheetsInfo: Uint8Array) => void;
    sendSheetsInfoRender: (sheetsInfo: Uint8Array) => void;
    sendSheetInfoUpdateClient: (sheetInfo: Uint8Array) => void;
    sendSheetInfoUpdateRender: (sheetInfo: Uint8Array) => void;
    sendA1Context: (context: Uint8Array) => void;
    sendHashRenderFills: (hashRenderFills: Uint8Array) => void;
    sendHashesDirtyFills: (dirtyHashes: Uint8Array) => void;
    sendSheetMetaFills: (sheetId: string, fills: Uint8Array) => void;
    sendBordersSheet: (sheetId: string, borders: Uint8Array) => void;
    sendDeleteSheetRender: (sheetId: string) => void;
    sendSetCursor: (cursor: string) => void;
    requestTransactions: (sequenceNum: number) => void;
    sendSheetOffsetsClient: (sheetId: string, offsets: Uint8Array) => void;
    sendSheetOffsetsRender: (sheetId: string, offsets: Uint8Array) => void;
    sendSheetHtml: (html: Uint8Array) => void;
    sendUpdateHtml: (html: Uint8Array) => void;
    sendGenerateThumbnail: () => void;
    sendSheetCodeCells: (sheetId: string, renderCodeCells: Uint8Array) => void;
    sendSheetBoundsUpdateClient: (sheetBounds: Uint8Array) => void;
    sendSheetBoundsUpdateRender: (sheetBounds: Uint8Array) => void;
    sendTransactionStartClient: (transactionId: string, transactionName: TransactionName) => void;
    sendTransactionStartRender: (transactionId: string, transactionName: TransactionName) => void;
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
    sendSheetConditionalFormats: (sheetId: string, conditionalFormats: Uint8Array) => void;
    sendValidationWarnings: (warnings: Uint8Array) => void;
    sendRequestRowHeights: (transactionId: string, sheetId: string, rows: string) => void;
    sendMultiplayerSynced: () => void;
    sendHashRenderCellsRender: (hashRenderCells: Uint8Array) => void;
    sendHashesDirtyRender: (dirtyHashes: Uint8Array) => void;
    sendViewportBuffer: (buffer: SharedArrayBuffer) => void;
    sendClientMessage: (message: string, severity: JsSnackbarSeverity) => void;
    sendDataTablesCache: (sheetId: string, dataTablesCache: Uint8Array) => void;
    sendContentCache: (sheetId: string, contentCache: Uint8Array) => void;
    sendMergeCells: (sheetId: string, mergeCells: Uint8Array) => void;
    sendMergeCellsRender: (sheetId: string, mergeCells: Uint8Array, dirtyHashes: Uint8Array) => void;
    sendCodeRunningState: (transactionId: string, codeOperations: string) => void;
  };

export const addUnsentTransaction = (transactionId: string, transactions: string, operations: number) => {
  return self.addUnsentTransaction(transactionId, transactions, operations);
};

export const jsSendTransaction = (transactionId: string, operations: Uint8Array) => {
  return self.sendTransaction(transactionId, operations.buffer);
};

export const jsTime = (name: string) => console.time(name);
export const jsTimeEnd = (name: string) => console.timeEnd(name);

export const jsImportProgress = (filename: string, current: number, total: number) => {
  return self.sendImportProgress(filename, current, total);
};

export const jsAddSheet = (sheetInfo: Uint8Array, user: boolean) => {
  const clientCopy = new Uint8Array(sheetInfo);
  self.sendAddSheetClient(clientCopy, user);
  self.sendAddSheetRender(sheetInfo);
};

export const jsDeleteSheet = (sheetId: string, user: boolean) => {
  self.sendDeleteSheetClient(sheetId, user);
  self.sendDeleteSheetRender(sheetId);
};

export const jsSheetInfo = (sheetInfo: Uint8Array) => {
  const clientCopy = new Uint8Array(sheetInfo);
  self.sendSheetsInfoClient(clientCopy);
  self.sendSheetsInfoRender(sheetInfo);
};

export const jsSheetInfoUpdate = (sheetInfo: Uint8Array) => {
  const clientCopy = new Uint8Array(sheetInfo);
  self.sendSheetInfoUpdateClient(clientCopy);
  self.sendSheetInfoUpdateRender(sheetInfo);
};

export const jsHashRenderFills = (hashRenderFills: Uint8Array) => {
  self.sendHashRenderFills(hashRenderFills);
};

export const jsHashesDirtyFills = (dirtyHashes: Uint8Array) => {
  self.sendHashesDirtyFills(dirtyHashes);
};

export const jsSheetMetaFills = (sheetId: string, sheetMetaFills: Uint8Array) => {
  self.sendSheetMetaFills(sheetId, sheetMetaFills);
};

export const jsOffsetsModified = (sheetId: string, offsets: Uint8Array) => {
  const clientCopy = new Uint8Array(offsets);
  self.sendSheetOffsetsClient(sheetId, clientCopy);
  self.sendSheetOffsetsRender(sheetId, offsets);
};

export const jsHtmlOutput = (html: Uint8Array) => {
  self.sendSheetHtml(html);
};

export const jsUpdateHtml = (html: Uint8Array) => {
  self.sendUpdateHtml(html);
};

export const jsRequestTransactions = (sequenceNum: bigint) => {
  self.requestTransactions(Number(sequenceNum));
};

export const jsSetCursor = (cursor: string) => {
  self.sendSetCursor(cursor);
};

export const jsGenerateThumbnail = () => {
  self.sendGenerateThumbnail();
};

export const jsBordersSheet = (sheetId: string, borders: Uint8Array) => {
  self.sendBordersSheet(sheetId, borders);
};

export const jsSheetCodeCells = (sheetId: string, renderCodeCells: Uint8Array) => {
  self.sendSheetCodeCells(sheetId, renderCodeCells);
};

export const jsSheetBoundsUpdate = (bounds: Uint8Array) => {
  const clientCopy = new Uint8Array(bounds);
  self.sendSheetBoundsUpdateClient(clientCopy);
  self.sendSheetBoundsUpdateRender(bounds);
};

export const jsTransactionStart = (transaction_id: string, transaction_name: string) => {
  const transactionName = JSON.parse(transaction_name);
  self.sendTransactionStartClient(transaction_id, transactionName);
  self.sendTransactionStartRender(transaction_id, transactionName);
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

export const jsSheetConditionalFormats = (sheetId: string, conditionalFormats: Uint8Array) => {
  self.sendSheetConditionalFormats(sheetId, conditionalFormats);
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

export const jsHashesRenderCells = (render_cells: Uint8Array) => {
  self.sendHashRenderCellsRender(render_cells);
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

export const jsA1Context = (context: Uint8Array) => {
  self.sendA1Context(context);
};

export const jsSendDataTablesCache = (sheetId: string, dataTablesCache: Uint8Array) => {
  self.sendDataTablesCache(sheetId, dataTablesCache);
};

export const jsSendContentCache = (sheetId: string, contentCache: Uint8Array) => {
  self.sendContentCache(sheetId, contentCache);
};

export const jsCodeRunningState = (transactionId: string, codeOperations: string) => {
  self.sendCodeRunningState(transactionId, codeOperations);
};

export const jsTimestamp = (): bigint => {
  return BigInt(Date.now());
};

export const jsMergeCells = (sheetId: string, mergeCells: Uint8Array, dirtyHashes: Uint8Array) => {
  const clientCopy = new Uint8Array(mergeCells);
  self.sendMergeCells(sheetId, clientCopy);
  self.sendMergeCellsRender(sheetId, mergeCells, dirtyHashes);
};
