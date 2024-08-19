import {
  CellAlign,
  CellFormatSummary,
  CellVerticalAlign,
  CellWrap,
  CodeCellLanguage,
  Format,
  JsCellValue,
  JsCodeCell,
  JsHtmlOutput,
  JsRenderBorders,
  JsRenderCell,
  JsRenderCodeCell,
  JsRenderFill,
  JsRowHeight,
  JsSheetFill,
  JsValidationWarning,
  MinMax,
  SearchOptions,
  Selection,
  SheetBounds,
  SheetInfo,
  SheetPos,
  SheetRect,
  SummarizeSelectionResult,
  TransactionName,
  Validation,
} from '@/app/quadratic-core-types';
import { CodeRun } from '../CodeRun';
import { MultiplayerState } from '../multiplayerWebWorker/multiplayerClientMessages';

//#region Initialize

export interface ClientCoreLoad {
  type: 'clientCoreLoad';
  url: string;
  version: string;
  sequenceNumber: number;
  id: number;
  fileId: string;
}

export interface CoreClientLoad {
  type: 'coreClientLoad';
  id: number;
  version?: string;
  error?: string;
}

export interface ClientCoreUpgradeGridFile {
  type: 'clientCoreUpgradeGridFile';
  grid: Uint8Array;
  sequenceNumber: number;
  id: number;
}

export interface CoreClientUpgradeFile {
  type: 'coreClientUpgradeGridFile';
  grid: Uint8Array;
  version: string;
  id: number;
}

export interface ClientCoreInit {
  type: 'clientCoreInit';
  env: ImportMetaEnv;
}

export interface ClientCoreInitMultiplayer {
  type: 'clientCoreInitMultiplayer';
}

export interface CoreClientMultiplayerState {
  type: 'coreClientMultiplayerState';
  state: MultiplayerState;
}

export interface CoreClientConnectionState {
  type: 'coreClientConnectionState';
  state: 'loading' | 'ready' | 'error' | 'running';

  // current cell being executed
  current?: CodeRun;

  // cells awaiting execution
  awaitingExecution?: CodeRun[];
}

export interface ClientCoreInitPython {
  type: 'clientCoreInitPython';
}

export interface ClientCoreInitJavascript {
  type: 'clientCoreInitJavascript';
}

export interface ClientCoreExport {
  type: 'clientCoreExport';
  id: number;
}

export interface CoreClientExport {
  type: 'coreClientExport';
  grid: Uint8Array;
  id: number;
}

export interface ClientCoreExportCsvSelection {
  type: 'clientCoreExportCsvSelection';
  id: number;
  selection: Selection;
}

export interface CoreClientExportCsvSelection {
  type: 'coreClientExportCsvSelection';
  csv: string;
  id: number;
}

//#endregion

//#region Query

export interface ClientCoreGetCodeCell {
  type: 'clientCoreGetCodeCell';
  sheetId: string;
  x: number;
  y: number;
  id: number;
}

export interface CoreClientGetCodeCell {
  type: 'coreClientGetCodeCell';
  cell: JsCodeCell | undefined;
  id: number;
}

export interface ClientCoreCellHasContent {
  type: 'clientCoreCellHasContent';
  sheetId: string;
  x: number;
  y: number;
  id: number;
}

export interface CoreClientCellHasContent {
  type: 'coreClientCellHasContent';
  hasContent: boolean;
  id: number;
}

export interface ClientCoreGetEditCell {
  type: 'clientCoreGetEditCell';
  sheetId: string;
  x: number;
  y: number;
  id: number;
}

export interface CoreClientGetEditCell {
  type: 'coreClientGetEditCell';
  cell: string | undefined;
  id: number;
}

export interface ClientCoreGetCellFormatSummary {
  type: 'clientCoreGetCellFormatSummary';
  id: number;
  sheetId: string;
  x: number;
  y: number;
  withSheetInfo: boolean;
}

export interface CoreClientGetCellFormatSummary {
  type: 'coreClientGetCellFormatSummary';
  formatSummary: CellFormatSummary;
  id: number;
}

export interface ClientCoreGetFormatAll {
  type: 'clientCoreGetFormatAll';
  id: number;
  sheetId: string;
}

export interface CoreClientGetFormatAll {
  type: 'coreClientGetFormatAll';
  id: number;
  format?: Format;
}

export interface ClientCoreGetFormatColumn {
  type: 'clientCoreGetFormatColumn';
  id: number;
  sheetId: string;
  column: number;
}

export interface CoreClientGetFormatColumn {
  type: 'coreClientGetFormatColumn';
  id: number;
  format?: Format;
}

export interface ClientCoreGetFormatRow {
  type: 'clientCoreGetFormatRow';
  id: number;
  sheetId: string;
  row: number;
}

export interface CoreClientGetFormatRow {
  type: 'coreClientGetFormatRow';
  id: number;
  format?: Format;
}

export interface ClientCoreGetFormatCell {
  type: 'clientCoreGetFormatCell';
  id: number;
  sheetId: string;
  x: number;
  y: number;
}

export interface CoreClientGetFormatCell {
  type: 'coreClientGetFormatCell';
  id: number;
  format?: Format;
}

export interface ClientCoreSummarizeSelection {
  type: 'clientCoreSummarizeSelection';
  decimalPlaces: number;
  id: number;
  selection: Selection;
}

export interface CoreClientSummarizeSelection {
  type: 'coreClientSummarizeSelection';
  id: number;
  summary: SummarizeSelectionResult | undefined;
}

export interface ClientCoreSearch {
  type: 'clientCoreSearch';
  search: string;
  searchOptions: SearchOptions;
  id: number;
}

export interface CoreClientSearch {
  type: 'coreClientSearch';
  results: SheetPos[];
  id: number;
}

export interface ClientCoreHasRenderCells {
  type: 'clientCoreHasRenderCells';
  id: number;
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CoreClientHasRenderCells {
  type: 'coreClientHasRenderCells';
  id: number;
  hasRenderCells: boolean;
}

export interface CoreClientGetJwt {
  type: 'coreClientGetJwt';
  id: number;
}

export interface ClientCoreGetJwt {
  type: 'clientCoreGetJwt';
  id: number;
  jwt: string;
}

//#endregion

//#region Render

export interface ClientCoreGetRenderCell {
  type: 'clientCoreGetRenderCell';
  sheetId: string;
  x: number;
  y: number;
  id: number;
}

export interface CoreClientGetRenderCell {
  type: 'coreClientGetRenderCell';
  cell: JsRenderCell | undefined;
  id: number;
}

export interface CoreClientHtmlOutput {
  type: 'coreClientHtmlOutput';
  html: JsHtmlOutput[];
}

export interface CoreClientUpdateHtml {
  type: 'coreClientUpdateHtml';
  html: JsHtmlOutput;
}

//#endregion

//#region Set values

export interface ClientCoreSetCellValue {
  type: 'clientCoreSetCellValue';
  sheetId: string;
  x: number;
  y: number;
  value: string;
  cursor?: string;
}

export interface ClientCoreSetCellBold {
  type: 'clientCoreSetCellBold';
  selection: Selection;
  bold: boolean;
  cursor?: string;
}

export interface ClientCoreSetCellItalic {
  type: 'clientCoreSetCellItalic';
  selection: Selection;
  italic: boolean;
  cursor?: string;
}

export interface ClientCoreSetCellFillColor {
  type: 'clientCoreSetCellFillColor';
  selection: Selection;
  fillColor?: string;
  cursor?: string;
}

export interface ClientCoreSetCellTextColor {
  type: 'clientCoreSetCellTextColor';
  selection: Selection;
  color?: string;
  cursor?: string;
}

export interface ClientCoreSetCellAlign {
  type: 'clientCoreSetCellAlign';
  selection: Selection;
  align: CellAlign;
  cursor?: string;
}

export interface ClientCoreSetCellVerticalAlign {
  type: 'clientCoreSetCellVerticalAlign';
  selection: Selection;
  verticalAlign: CellVerticalAlign;
  cursor?: string;
}

export interface ClientCoreSetCellWrap {
  type: 'clientCoreSetCellWrap';
  selection: Selection;
  wrap: CellWrap;
  cursor?: string;
}

export interface ClientCoreSetCurrency {
  type: 'clientCoreSetCurrency';
  selection: Selection;
  symbol: string;
  cursor?: string;
}

export interface ClientCoreSetPercentage {
  type: 'clientCoreSetPercentage';
  selection: Selection;
  cursor?: string;
}

export interface ClientCoreSetExponential {
  type: 'clientCoreSetExponential';
  selection: Selection;
  cursor?: string;
}

export interface ClientCoreRemoveCellNumericFormat {
  type: 'clientCoreRemoveCellNumericFormat';
  selection: Selection;
  cursor?: string;
}

export interface ClientCoreChangeDecimals {
  type: 'clientCoreChangeDecimals';
  selection: Selection;
  delta: number;
  cursor?: string;
}

export interface ClientCoreClearFormatting {
  type: 'clientCoreClearFormatting';
  selection: Selection;
  cursor?: string;
}

export interface ClientCoreSetCommas {
  type: 'clientCoreSetCommas';
  selection: Selection;
  commas: boolean;
  cursor?: string;
}

export interface ClientCoreImportCsv {
  type: 'clientCoreImportCsv';
  sheetId: string;
  x: number;
  y: number;
  id: number;
  file: ArrayBuffer;
  fileName: string;
  cursor?: string;
}

export interface CoreClientImportCsv {
  type: 'coreClientImportCsv';
  id: number;
  error: string | undefined;
}

export interface ClientCoreImportParquet {
  type: 'clientCoreImportParquet';
  sheetId: string;
  x: number;
  y: number;
  id: number;
  file: ArrayBuffer;
  fileName: string;
  cursor?: string;
}

export interface CoreClientImportParquet {
  type: 'coreClientImportParquet';
  id: number;
  error: string | undefined;
}

export interface ClientCoreDeleteCellValues {
  type: 'clientCoreDeleteCellValues';
  selection: Selection;
  cursor?: string;
}

export interface ClientCoreSetCodeCellValue {
  type: 'clientCoreSetCodeCellValue';
  sheetId: string;
  x: number;
  y: number;
  language: CodeCellLanguage;
  codeString: string;
  cursor?: string;
}

export interface CoreClientSheetFills {
  type: 'coreClientSheetFills';
  sheetId: string;
  fills: JsRenderFill[];
}

export interface CoreClientSheetMetaFills {
  type: 'coreClientSheetMetaFills';
  sheetId: string;
  fills: JsSheetFill;
}

export interface ClientCoreRerunCodeCells {
  type: 'clientCoreRerunCodeCells';
  sheetId?: string;
  x?: number;
  y?: number;
  cursor: string;
}

export interface ClientCoreSetRegionBorders {
  type: 'clientCoreSetRegionBorders';
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  selection: string;
  style?: string;
  cursor: string;
}

export interface ClientCoreSetCellRenderResize {
  type: 'clientCoreSetCellRenderResize';
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cursor: string;
}

export interface ClientCoreAutocomplete {
  type: 'clientCoreAutocomplete';
  sheetId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  fullX1: number;
  fullY1: number;
  fullX2: number;
  fullY2: number;
  cursor: string;
}

export interface ClientCoreUpdateValidation {
  type: 'clientCoreUpdateValidation';
  validation: Validation;
  cursor: string;
}

export interface ClientCoreRemoveValidation {
  type: 'clientCoreRemoveValidation';
  sheetId: string;
  validationId: string;
  cursor: string;
}

export interface ClientCoreRemoveValidations {
  type: 'clientCoreRemoveValidations';
  sheetId: string;
  cursor: string;
}

export interface ClientCoreGetValidationFromPos {
  type: 'clientCoreGetValidationFromPos';
  sheetId: string;
  x: number;
  y: number;
  id: number;
}

//#endregion

//#region Sheets

export interface CoreClientSheetInfo {
  type: 'coreClientSheetInfo';
  sheetInfo: SheetInfo[];
}

export interface CoreClientSheetBoundsUpdate {
  type: 'coreClientSheetBoundsUpdate';
  sheetBounds: SheetBounds;
}

export interface ClientCoreAddSheet {
  type: 'clientCoreAddSheet';
  cursor?: string;
}

export interface CoreClientAddSheet {
  type: 'coreClientAddSheet';
  sheetInfo: SheetInfo;
  user: boolean;
}

export interface ClientCoreDeleteSheet {
  type: 'clientCoreDeleteSheet';
  sheetId: string;
  cursor: string;
}

export interface CoreClientDeleteSheet {
  type: 'coreClientDeleteSheet';
  sheetId: string;
  user: boolean;
}

export interface ClientCoreMoveSheet {
  type: 'clientCoreMoveSheet';
  sheetId: string;
  previous?: string;
  cursor: string;
}

export interface CoreClientSheetInfoUpdate {
  type: 'coreClientSheetInfoUpdate';
  sheetInfo: SheetInfo;
}

export interface ClientCoreSetSheetName {
  type: 'clientCoreSetSheetName';
  sheetId: string;
  name: string;
  cursor: string;
}

export interface ClientCoreSetSheetColor {
  type: 'clientCoreSetSheetColor';
  sheetId: string;
  color: string | undefined;
  cursor: string;
}

export interface ClientCoreDuplicateSheet {
  type: 'clientCoreDuplicateSheet';
  sheetId: string;
  cursor: string;
}

export interface CoreClientSetCursor {
  type: 'coreClientSetCursor';
  cursor: string;
}

export interface CoreClientSheetOffsets {
  type: 'coreClientSheetOffsets';
  sheetId: string;
  column?: number;
  row?: number;
  size: number;
  borders: JsRenderBorders;
}

export interface CoreClientGenerateThumbnail {
  type: 'coreClientGenerateThumbnail';
}

export interface CoreClientSheetBorders {
  type: 'coreClientSheetBorders';
  sheetId: string;
  borders: JsRenderBorders;
}

export interface CoreClientSheetRenderCells {
  type: 'coreClientSheetRenderCells';
  sheetId: string;
  renderCells: JsRenderCell[];
}

export interface CoreClientSheetCodeCellRender {
  type: 'coreClientSheetCodeCellRender';
  sheetId: string;
  codeCells: JsRenderCodeCell[];
}

export interface CoreClientResizeRowHeights {
  type: 'coreClientResizeRowHeights';
  sheetId: string;
  rowHeights: JsRowHeight[];
}

//#endregion

//#region Undo/Redo

export interface ClientCoreUndo {
  type: 'clientCoreUndo';
  cursor: string;
}

export interface ClientCoreRedo {
  type: 'clientCoreRedo';
  cursor: string;
}

//#endregion

//#region Clipboard

export interface ClientCoreCopyToClipboard {
  type: 'clientCoreCopyToClipboard';
  id: number;
  selection: Selection;
}

export interface CoreClientCopyToClipboard {
  type: 'coreClientCopyToClipboard';
  id: number;
  plainText: string;
  html: string;
}

export interface ClientCoreCutToClipboard {
  type: 'clientCoreCutToClipboard';
  id: number;
  selection: Selection;
  cursor: string;
}

export interface CoreClientCutToClipboard {
  type: 'coreClientCutToClipboard';
  id: number;
  plainText: string;
  html: string;
}

export interface ClientCorePasteFromClipboard {
  type: 'clientCorePasteFromClipboard';
  selection: Selection;
  plainText?: string;
  html?: string;
  special: string;
  cursor: string;
}

//#endregion

//#region Bounds

export interface ClientCoreGetColumnsBounds {
  type: 'clientCoreGetColumnsBounds';
  sheetId: string;
  start: number;
  end: number;
  ignoreFormatting: boolean;
  id: number;
}

export interface CoreClientGetColumnsBounds {
  type: 'coreClientGetColumnsBounds';
  bounds?: MinMax;
  id: number;
}

export interface ClientCoreGetRowsBounds {
  type: 'clientCoreGetRowsBounds';
  sheetId: string;
  start: number;
  end: number;
  ignoreFormatting: boolean;
  id: number;
}

export interface CoreClientGetRowsBounds {
  type: 'coreClientGetRowsBounds';
  bounds?: MinMax;
  id: number;
}

export interface ClientCoreFindNextColumn {
  type: 'clientCoreFindNextColumn';
  id: number;
  sheetId: string;
  columnStart: number;
  row: number;
  reverse: boolean;
  withContent: boolean;
}

export interface CoreClientFindNextColumn {
  type: 'coreClientFindNextColumn';
  id: number;
  column?: number;
}

export interface ClientCoreFindNextRow {
  type: 'clientCoreFindNextRow';
  id: number;
  sheetId: string;
  rowStart: number;
  column: number;
  reverse: boolean;
  withContent: boolean;
}

export interface CoreClientFindNextRow {
  type: 'coreClientFindNextRow';
  id: number;
  row?: number;
}

export interface ClientCoreCommitTransientResize {
  type: 'clientCoreCommitTransientResize';
  sheetId: string;
  transientResize: string /*TransientResize*/;
  cursor: string;
}

export interface ClientCoreCommitSingleResize {
  type: 'clientCoreCommitSingleResize';
  sheetId: string;
  column: number | undefined;
  row: number | undefined;
  size: number;
  cursor: string;
}

//#endregion

//#region transactions

export interface CoreClientImportProgress {
  type: 'coreClientImportProgress';
  filename: string;
  current: number;
  total: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CoreClientTransactionStart {
  type: 'coreClientTransactionStart';
  transactionId: string;
  transactionType: TransactionName;
}

export interface CoreClientTransactionProgress {
  type: 'coreClientTransactionProgress';
  transactionId: string;
  remainingOperations: number;
}

export interface CoreClientUpdateCodeCell {
  type: 'coreClientUpdateCodeCell';
  sheetId: string;
  x: number;
  y: number;
  codeCell?: JsCodeCell;
  renderCodeCell?: JsRenderCodeCell;
}

export interface ClientCoreImportExcel {
  type: 'clientCoreImportExcel';
  file: Uint8Array;
  fileName: string;
  cursor?: string;
  id: number;
}

export interface CoreClientImportExcel {
  type: 'coreClientImportExcel';
  id: number;
  contents?: Uint8Array;
  version?: string;
  error?: string;
}

export interface ClientCoreCancelExecution {
  type: 'clientCoreCancelExecution';
  language: CodeCellLanguage;
}

export interface CoreClientOfflineTransactions {
  type: 'coreClientOfflineTransactionStats';
  transactions: number;
  operations: number;
}

export interface CoreClientOfflineTransactionsApplied {
  type: 'coreClientOfflineTransactionsApplied';
  timestamps: number[];
}

export interface CoreClientUndoRedo {
  type: 'coreClientUndoRedo';
  undo: boolean;
  redo: boolean;
}

export interface ClientCoreMoveCells {
  type: 'clientCoreMoveCells';
  source: SheetRect;
  targetSheetId: string;
  targetX: number;
  targetY: number;
  cursor: string;
}

export interface CoreClientSetCursorSelection {
  type: 'coreClientSetCursorSelection';
  selection: Selection;
}

//#endregion

export interface CoreClientImage {
  type: 'coreClientImage';
  sheetId: string;
  x: number;
  y: number;
  image?: string;
  w?: string;
  h?: string;
}

export interface ClientCoreGetValidations {
  type: 'clientCoreGetValidations';
  id: number;
  sheetId: string;
}

export interface CoreClientGetValidations {
  type: 'coreClientGetValidations';
  id: number;
  validations: Validation[];
}

export interface CoreClientSheetValidations {
  type: 'coreClientSheetValidations';
  sheetId: string;
  validations: Validation[];
}

export interface CoreClientGetValidationFromPos {
  type: 'coreClientGetValidationFromPos';
  id: number;
  validation: Validation | undefined;
}

export interface ClientCoreGetValidationList {
  type: 'clientCoreGetValidationList';
  id: number;
  sheetId: string;
  x: number;
  y: number;
}

export interface CoreClientGetValidationList {
  type: 'coreClientGetValidationList';
  id: number;
  validations: string[];
}

export interface ClientCoreGetDisplayCell {
  type: 'clientCoreGetDisplayCell';
  sheetId: string;
  x: number;
  y: number;
  id: number;
}

export interface CoreClientGetDisplayCell {
  type: 'coreClientGetDisplayCell';
  cell?: string;
  id: number;
}

export interface CoreClientRenderValidationWarnings {
  type: 'coreClientRenderValidationWarnings';
  sheetId: string;
  hashX: number | undefined;
  hashY: number | undefined;
  validationWarnings: JsValidationWarning[];
}

export interface CoreClientMultiplayerSynced {
  type: 'coreClientMultiplayerSynced';
}

export interface ClientCoreSetDateTimeFormat {
  type: 'clientCoreSetDateTimeFormat';
  selection: Selection;
  format: string;
  cursor: string;
}

export interface ClientCoreValidateInput {
  type: 'clientCoreValidateInput';
  id: number;
  sheetId: string;
  x: number;
  y: number;
  input: string;
}

export interface CoreClientValidateInput {
  type: 'coreClientValidateInput';
  id: number;
  validationId: string | undefined;
}

export interface ClientCoreGetCellValue {
  type: 'clientCoreGetCellValue';
  id: number;
  sheetId: string;
  x: number;
  y: number;
}

export interface CoreClientGetCellValue {
  type: 'coreClientGetCellValue';
  id: number;
  value: JsCellValue | undefined;
}

export type ClientCoreMessage =
  | ClientCoreLoad
  | ClientCoreGetCodeCell
  | ClientCoreCellHasContent
  | ClientCoreGetEditCell
  | ClientCoreSetCellValue
  | ClientCoreGetCellFormatSummary
  | ClientCoreInitMultiplayer
  | ClientCoreSummarizeSelection
  | ClientCoreSetCellBold
  | ClientCoreSetCellItalic
  | ClientCoreSetCellFillColor
  | ClientCoreSetCellTextColor
  | ClientCoreSetCellAlign
  | ClientCoreSetCellVerticalAlign
  | ClientCoreSetCellWrap
  | ClientCoreSetCurrency
  | ClientCoreSetPercentage
  | ClientCoreSetExponential
  | ClientCoreRemoveCellNumericFormat
  | ClientCoreChangeDecimals
  | ClientCoreClearFormatting
  | ClientCoreGetRenderCell
  | ClientCoreSetCommas
  | ClientCoreImportCsv
  | ClientCoreImportParquet
  | ClientCoreDeleteCellValues
  | ClientCoreSetCodeCellValue
  | ClientCoreAddSheet
  | ClientCoreDeleteSheet
  | ClientCoreMoveSheet
  | ClientCoreSetSheetName
  | ClientCoreSetSheetColor
  | ClientCoreDuplicateSheet
  | ClientCoreUndo
  | ClientCoreRedo
  | ClientCoreUpgradeGridFile
  | ClientCoreExport
  | ClientCoreSearch
  | ClientCoreRerunCodeCells
  | ClientCoreHasRenderCells
  | ClientCoreCopyToClipboard
  | ClientCoreCutToClipboard
  | ClientCorePasteFromClipboard
  | ClientCoreSetRegionBorders
  | ClientCoreSetCellRenderResize
  | ClientCoreAutocomplete
  | ClientCoreExportCsvSelection
  | ClientCoreGetColumnsBounds
  | ClientCoreGetRowsBounds
  | ClientCoreFindNextColumn
  | ClientCoreFindNextRow
  | ClientCoreCommitTransientResize
  | ClientCoreCommitSingleResize
  | ClientCoreInit
  | ClientCoreInitPython
  | ClientCoreInitJavascript
  | ClientCoreImportExcel
  | ClientCoreCancelExecution
  | ClientCoreGetJwt
  | ClientCoreMoveCells
  | ClientCoreGetFormatAll
  | ClientCoreGetFormatColumn
  | ClientCoreGetFormatRow
  | ClientCoreGetFormatCell
  | ClientCoreSetDateTimeFormat
  | ClientCoreGetValidations
  | ClientCoreUpdateValidation
  | ClientCoreRemoveValidation
  | ClientCoreRemoveValidations
  | ClientCoreGetValidationFromPos
  | ClientCoreGetValidationList
  | ClientCoreGetDisplayCell
  | ClientCoreValidateInput
  | ClientCoreGetCellValue;

export type CoreClientMessage =
  | CoreClientGetCodeCell
  | CoreClientGetEditCell
  | CoreClientCellHasContent
  | CoreClientGetCellFormatSummary
  | CoreClientSummarizeSelection
  | CoreClientGetRenderCell
  | CoreClientImportCsv
  | CoreClientImportParquet
  | CoreClientAddSheet
  | CoreClientSheetInfo
  | CoreClientSheetFills
  | CoreClientDeleteSheet
  | CoreClientSheetInfoUpdate
  | CoreClientSetCursor
  | CoreClientSheetOffsets
  | CoreClientUpgradeFile
  | CoreClientExport
  | CoreClientSearch
  | CoreClientHasRenderCells
  | CoreClientCopyToClipboard
  | CoreClientCutToClipboard
  | CoreClientHtmlOutput
  | CoreClientUpdateHtml
  | CoreClientExportCsvSelection
  | CoreClientGetColumnsBounds
  | CoreClientGetRowsBounds
  | CoreClientFindNextColumn
  | CoreClientFindNextRow
  | CoreClientGenerateThumbnail
  | CoreClientLoad
  | CoreClientSheetBorders
  | CoreClientSheetRenderCells
  | CoreClientSheetCodeCellRender
  | CoreClientSheetBoundsUpdate
  | CoreClientImportProgress
  | CoreClientTransactionStart
  | CoreClientTransactionProgress
  | CoreClientUpdateCodeCell
  | CoreClientImportExcel
  | CoreClientMultiplayerState
  | CoreClientConnectionState
  | CoreClientOfflineTransactions
  | CoreClientUndoRedo
  | CoreClientGetJwt
  | CoreClientImage
  | CoreClientGetFormatAll
  | CoreClientGetFormatColumn
  | CoreClientGetFormatRow
  | CoreClientGetFormatCell
  | CoreClientSheetMetaFills
  | CoreClientSetCursorSelection
  | CoreClientOfflineTransactionsApplied
  | CoreClientGetValidations
  | CoreClientSheetValidations
  | CoreClientGetValidationFromPos
  | CoreClientResizeRowHeights
  | CoreClientGetValidationList
  | CoreClientGetDisplayCell
  | CoreClientRenderValidationWarnings
  | CoreClientResizeRowHeights
  | CoreClientMultiplayerSynced
  | CoreClientValidateInput
  | CoreClientGetCellValue;
