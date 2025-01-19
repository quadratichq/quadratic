// this file cannot include any non-type imports; see https://rustwasm.github.io/wasm-bindgen/reference/js-snippets.html#caveats

import type {
  ConnectionKind,
  JsBordersSheet,
  JsCellValuePos,
  JsCodeCell,
  JsCodeRun,
  JsHtmlOutput,
  JsOffset,
  JsRenderCell,
  JsRenderCodeCell,
  JsRenderFill,
  JsSheetFill,
  JsValidationWarning,
  SheetBounds,
  SheetInfo,
  TransactionName,
  Validation,
} from '@/app/quadratic-core-types';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    addUnsentTransaction: (transactionId: string, transaction: string, operations: number) => void;
    sendTransaction: (transactionId: string, operations: ArrayBuffer) => void;
    sendImportProgress: (
      filename: string,
      current: number,
      total: number,
      x: number,
      y: number,
      width: number,
      height: number
    ) => void;
    sendCompleteRenderCells: (sheetId: string, hashX: number, hashY: number, cells: JsRenderCell[]) => void;
    sendAddSheetClient: (sheetInfo: SheetInfo, user: boolean) => void;
    sendDeleteSheetClient: (sheetId: string, user: boolean) => void;
    sendSheetInfoClient: (sheets: SheetInfo[]) => void;
    sendSheetInfoRender: (sheets: SheetInfo[]) => void;
    sendSheetFills: (sheetId: string, fill: JsRenderFill[]) => void;
    sendSheetMetaFills: (sheetId: string, fills: JsSheetFill) => void;
    sendBordersSheet: (sheetId: string, borders?: JsBordersSheet) => void;
    sheetInfoUpdate: (sheetInfo: SheetInfo) => void;
    sendSheetInfoUpdateRender: (sheetInfo: SheetInfo) => void;
    sendAddSheetRender: (sheetInfo: SheetInfo) => void;
    sendDeleteSheetRender: (sheetId: string) => void;
    sendSetCursor: (cursor: string) => void;
    sendSetCursorSelection: (selection: string) => void;
    requestTransactions: (sequenceNum: number) => void;
    sendSheetOffsetsClient: (sheetId: string, offsets: JsOffset[]) => void;
    sendSheetOffsetsRender: (sheetId: string, offsets: JsOffset[]) => void;
    sendSheetHtml: (html: JsHtmlOutput[]) => void;
    sendUpdateHtml: (html: JsHtmlOutput) => void;
    sendGenerateThumbnail: () => void;
    sendSheetRenderCells: (sheetId: string, renderCells: JsRenderCell[]) => void;
    sendSheetCodeCell: (sheetId: string, codeCells: JsRenderCodeCell[]) => void;
    sendSheetBoundsUpdateClient: (sheetBounds: SheetBounds) => void;
    sendSheetBoundsUpdateRender: (sheetBounds: SheetBounds) => void;
    sendTransactionStart: (transactionId: string, transactionType: TransactionName) => void;
    sendTransactionProgress: (transactionId: string, remainingOperations: number) => void;
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
    sendSheetValidations: (sheetId: string, validations: Validation[]) => void;
    sendRequestRowHeights: (transactionId: string, sheetId: string, rows: string) => void;
    sendRenderValidationWarnings: (
      sheetId: string,
      hashX: number | undefined,
      hashY: number | undefined,
      validationWarnings: JsValidationWarning[]
    ) => void;
    sendMultiplayerSynced: () => void;
    sendHashesDirty: (sheetId: string, hashes: string) => void;
    sendViewportBuffer: (buffer: SharedArrayBuffer) => void;
    sendClientMessage: (message: string, error: boolean) => void;
    sendRequestAIResearcherResult: (
      transactionId: string,
      sheetPos: string,
      query: string,
      refCellValues: string,
      cellsAccessedValues: JsCellValuePos[][][]
    ) => void;
    sendAIResearcherState: (current: JsCodeRun[], awaitingExecution: JsCodeRun[]) => void;
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

export const jsRenderCellSheets = (sheetId: string, hashX: bigint, hashY: bigint, cells: string /*JsRenderCell[]*/) => {
  const renderCells = JSON.parse(cells) as JsRenderCell[];
  self.sendSheetRenderCells(sheetId, renderCells);
  self.sendCompleteRenderCells(sheetId, Number(hashX), Number(hashY), renderCells);
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

export const jsSheetInfoUpdate = (sheetInfoStringified: string) => {
  const sheetInfo = JSON.parse(sheetInfoStringified);
  self.sheetInfoUpdate(sheetInfo);
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

export const jsSetCursorSelection = (selection: string) => {
  self.sendSetCursorSelection(selection);
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

export const jsTransactionProgress = (transactionId: string, remainingOperations: number) => {
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

export const jsSheetValidations = (sheetId: string, validations: string) => {
  const validationsParsed = JSON.parse(validations) as Validation[];
  self.sendSheetValidations(sheetId, validationsParsed);
};

export const jsRequestRowHeights = (transactionId: string, sheetId: string, rows: string) => {
  self.sendRequestRowHeights(transactionId, sheetId, rows);
};

export const jsValidationWarning = (sheetId: string, warningsStringified: string) => {
  const warnings = JSON.parse(warningsStringified);
  self.sendRenderValidationWarnings(sheetId, undefined, undefined, warnings);
};

export const jsRenderValidationWarnings = (sheetId: string, hashX: BigInt, hashY: BigInt, warnings: string) => {
  const validationWarnings = JSON.parse(warnings) as JsValidationWarning[];
  self.sendRenderValidationWarnings(sheetId, Number(hashX), Number(hashY), validationWarnings);
};

export const jsMultiplayerSynced = () => {
  self.sendMultiplayerSynced();
};

export const jsHashesDirty = (sheetId: string, hashes: string) => {
  self.sendHashesDirty(sheetId, hashes);
};

export const jsClientMessage = (message: string, error: boolean) => {
  self.sendClientMessage(message, error);
};

export const jsSendViewportBuffer = (buffer: SharedArrayBuffer) => {
  self.sendViewportBuffer(buffer);
};

export const jsRequestAIResearcherResult = (
  transactionId: string,
  sheetPos: string,
  query: string,
  refCellValues: string,
  cellsAccessedValuesStringified: string
) => {
  const cellsAccessedValues = JSON.parse(cellsAccessedValuesStringified) as JsCellValuePos[][][];
  self.sendRequestAIResearcherResult(transactionId, sheetPos, query, refCellValues, cellsAccessedValues);
};

export const jsAIResearcherState = (current: string, awaitingExecution: string) => {
  const currentCodeRun = JSON.parse(current) as JsCodeRun[];
  const awaitingExecutionCodeRun = JSON.parse(awaitingExecution) as JsCodeRun[];
  self.sendAIResearcherState(currentCodeRun, awaitingExecutionCodeRun);
};
