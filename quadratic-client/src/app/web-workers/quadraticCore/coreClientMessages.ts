import {
  BorderSelection,
  BorderStyle,
  CellAlign,
  CellFormatSummary,
  CellVerticalAlign,
  CellWrap,
  CodeCellLanguage,
  Format,
  JsBordersSheet,
  JsCellValue,
  JsCellValuePosAIContext,
  JsCodeCell,
  JsCoordinate,
  JsHtmlOutput,
  JsOffset,
  JsRenderCell,
  JsRenderCodeCell,
  JsRenderFill,
  JsSheetFill,
  JsSummarizeSelectionResult,
  JsValidationWarning,
  JumpDirection,
  MinMax,
  SearchOptions,
  SheetBounds,
  SheetInfo,
  SheetPos,
  SheetRect,
  TransactionName,
  Validation,
} from '@/app/quadratic-core-types';
import { Pos } from '@/app/quadratic-core/quadratic_core';
import { CodeRun } from '@/app/web-workers/CodeRun';
import { MultiplayerState } from '@/app/web-workers/multiplayerWebWorker/multiplayerClientMessages';
import { Rectangle } from 'pixi.js';

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
  grid: ArrayBuffer;
  id: number;
}

export interface ClientCoreExportCsvSelection {
  type: 'clientCoreExportCsvSelection';
  id: number;
  selection: string;
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
}

export interface CoreClientGetCellFormatSummary {
  type: 'coreClientGetCellFormatSummary';
  formatSummary: CellFormatSummary;
  id: number;
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
  selection: string;
}

export interface CoreClientSummarizeSelection {
  type: 'coreClientSummarizeSelection';
  id: number;
  summary: JsSummarizeSelectionResult | undefined;
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

export interface ClientCoreSetCellValues {
  type: 'clientCoreSetCellValues';
  sheetId: string;
  x: number;
  y: number;
  values: string[][];
  cursor?: string;
}

export interface ClientCoreSetCellBold {
  type: 'clientCoreSetCellBold';
  selection: string;
  bold: boolean;
  cursor?: string;
}

export interface ClientCoreSetCellItalic {
  type: 'clientCoreSetCellItalic';
  selection: string;
  italic: boolean;
  cursor?: string;
}

export interface ClientCoreSetCellFillColor {
  type: 'clientCoreSetCellFillColor';
  selection: string;
  fillColor?: string;
  cursor?: string;
}

export interface ClientCoreSetCellTextColor {
  type: 'clientCoreSetCellTextColor';
  selection: string;
  color?: string;
  cursor?: string;
}

export interface ClientCoreSetCellUnderline {
  type: 'clientCoreSetCellUnderline';
  selection: string;
  underline: boolean;
  cursor?: string;
}

export interface ClientCoreSetCellStrikeThrough {
  type: 'clientCoreSetCellStrikeThrough';
  selection: string;
  strikeThrough: boolean;
  cursor?: string;
}

export interface ClientCoreSetCellAlign {
  type: 'clientCoreSetCellAlign';
  selection: string;
  align: CellAlign;
  cursor?: string;
}

export interface ClientCoreSetCellVerticalAlign {
  type: 'clientCoreSetCellVerticalAlign';
  selection: string;
  verticalAlign: CellVerticalAlign;
  cursor?: string;
}

export interface ClientCoreSetCellWrap {
  type: 'clientCoreSetCellWrap';
  selection: string;
  wrap: CellWrap;
  cursor?: string;
}

export interface ClientCoreSetCurrency {
  type: 'clientCoreSetCurrency';
  selection: string;
  symbol: string;
  cursor?: string;
}

export interface ClientCoreSetPercentage {
  type: 'clientCoreSetPercentage';
  selection: string;
  cursor?: string;
}

export interface ClientCoreSetExponential {
  type: 'clientCoreSetExponential';
  selection: string;
  cursor?: string;
}

export interface ClientCoreRemoveCellNumericFormat {
  type: 'clientCoreRemoveCellNumericFormat';
  selection: string;
  cursor?: string;
}

export interface ClientCoreChangeDecimals {
  type: 'clientCoreChangeDecimals';
  selection: string;
  delta: number;
  cursor?: string;
}

export interface ClientCoreClearFormatting {
  type: 'clientCoreClearFormatting';
  selection: string;
  cursor?: string;
}

export interface ClientCoreSetCommas {
  type: 'clientCoreSetCommas';
  selection: string;
  commas: boolean;
  cursor?: string;
}

export interface ClientCoreUpgradeGridFile {
  type: 'clientCoreUpgradeGridFile';
  grid: ArrayBuffer;
  sequenceNumber: number;
  id: number;
}

export interface CoreClientUpgradeFile {
  type: 'coreClientUpgradeGridFile';
  id: number;
  contents?: ArrayBuffer;
  version?: string;
  error?: string;
}

export interface ClientCoreImportFile {
  type: 'clientCoreImportFile';
  file: ArrayBuffer;
  fileName: string;
  fileType: 'csv' | 'parquet' | 'excel';
  sheetId?: string;
  location?: JsCoordinate;
  cursor?: string;
  id: number;
}

export interface CoreClientImportFile {
  type: 'coreClientImportFile';
  id: number;
  contents?: ArrayBuffer;
  version?: string;
  error?: string;
}

export interface ClientCoreDeleteCellValues {
  type: 'clientCoreDeleteCellValues';
  selection: string;
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
  fills: JsSheetFill[];
}

export interface ClientCoreRerunCodeCells {
  type: 'clientCoreRerunCodeCells';
  sheetId?: string;
  x?: number;
  y?: number;
  cursor: string;
}

export interface ClientCoreSetBorders {
  type: 'clientCoreSetBorders';
  selection: string;
  borderSelection: BorderSelection;
  style?: BorderStyle;
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

export interface CoreClientSetCursorSelection {
  type: 'coreClientSetCursorSelection';
  selection: string;
}

export interface CoreClientSheetOffsets {
  type: 'coreClientSheetOffsets';
  sheetId: string;
  offsets: JsOffset[];
}

export interface CoreClientGenerateThumbnail {
  type: 'coreClientGenerateThumbnail';
}

export interface CoreClientBordersSheet {
  type: 'coreClientBordersSheet';
  sheetId: string;
  borders: JsBordersSheet;
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
  selection: string;
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
  selection: string;
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
  selection: string;
  plainText: string | undefined;
  html: string | undefined;
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

export interface ClientCoreJumpCursor {
  type: 'clientCoreJumpCursor';
  id: number;
  sheetId: string;
  current: JsCoordinate;
  direction: JumpDirection;
}

export interface CoreClientJumpCursor {
  type: 'coreClientJumpCursor';
  id: number;
  coordinate?: JsCoordinate;
}

export interface ClientCoreFindNextColumn {
  type: 'clientCoreFindNextColumn';
  id: number;
  sheetId: string;
  current: JsCoordinate;
  direction: JumpDirection;
}

export interface CoreClientJumpCursor {
  type: 'coreClientJumpCursor';
  id: number;
  coordinate?: JsCoordinate;
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

export interface ClientCoreFindNextColumnForRect {
  type: 'clientCoreFindNextColumnForRect';
  id: number;
  sheetId: string;
  columnStart: number;
  row: number;
  width: number;
  height: number;
  reverse: boolean;
}

export interface CoreClientFindNextColumnForRect {
  type: 'coreClientFindNextColumnForRect';
  id: number;
  column: number;
}

export interface ClientCoreFindNextRowForRect {
  type: 'clientCoreFindNextRowForRect';
  id: number;
  sheetId: string;
  column: number;
  rowStart: number;
  width: number;
  height: number;
  reverse: boolean;
}

export interface CoreClientFindNextRowForRect {
  type: 'coreClientFindNextRowForRect';
  id: number;
  row: number;
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

export interface ClientCoreMoveCodeCellVertically {
  type: 'clientCoreMoveCodeCellVertically';
  sheetId: string;
  x: number;
  y: number;
  sheetEnd: boolean;
  reverse: boolean;
  cursor: string;
  id: number;
}

export interface CoreClientMoveCodeCellVertically {
  type: 'coreClientMoveCodeCellVertically';
  pos: Pos;
  id: number;
}

export interface ClientCoreMoveCodeCellHorizontally {
  type: 'clientCoreMoveCodeCellHorizontally';
  sheetId: string;
  x: number;
  y: number;
  sheetEnd: boolean;
  reverse: boolean;
  cursor: string;
  id: number;
}

export interface CoreClientMoveCodeCellHorizontally {
  type: 'coreClientMoveCodeCellHorizontally';
  pos: Pos;
  id: number;
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
  validations: string[] | undefined;
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
  selection: string;
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

export interface ClientCoreGetAIContextRectsInSelections {
  type: 'clientCoreGetAIContextRectsInSelections';
  id: number;
  selections: string[];
  maxRects: number | undefined;
}

export interface CoreClientGetAIContextRectsInSelections {
  type: 'coreClientGetAIContextRectsInSelections';
  id: number;
  value: JsCellValuePosAIContext[][] | undefined;
}

export interface ClientCoreGetErroredCodeCellsInSelections {
  type: 'clientCoreGetErroredCodeCellsInSelections';
  id: number;
  selections: string[];
}

export interface CoreClientGetErroredCodeCellsInSelections {
  type: 'coreClientGetErroredCodeCellsInSelections';
  id: number;
  value: JsCodeCell[][] | undefined;
}

export interface ClientCoreNeighborText {
  type: 'clientCoreNeighborText';
  id: number;
  sheetId: string;
  x: number;
  y: number;
}

export interface CoreClientNeighborText {
  type: 'coreClientNeighborText';
  id: number;
  text: string[];
}

export interface ClientCoreDeleteColumns {
  type: 'clientCoreDeleteColumns';
  sheetId: string;
  columns: number[];
  cursor: string;
}

export interface ClientCoreDeleteRows {
  type: 'clientCoreDeleteRows';
  sheetId: string;
  rows: number[];
  cursor: string;
}

export interface ClientCoreInsertColumn {
  type: 'clientCoreInsertColumn';
  sheetId: string;
  column: number;
  right: boolean;
  cursor: string;
}

export interface ClientCoreInsertRow {
  type: 'clientCoreInsertRow';
  sheetId: string;
  row: number;
  below: boolean;
  cursor: string;
}

export interface ClientCoreFlattenDataTable {
  type: 'clientCoreFlattenDataTable';
  sheetId: string;
  x: number;
  y: number;
  cursor: string;
}

export interface ClientCoreCodeDataTableToDataTable {
  type: 'clientCoreCodeDataTableToDataTable';
  sheetId: string;
  x: number;
  y: number;
  cursor: string;
}

export interface ClientCoreGridToDataTable {
  type: 'clientCoreGridToDataTable';
  sheetRect: string;
  cursor: string;
}

export interface ClientCoreDataTableMeta {
  type: 'clientCoreDataTableMeta';
  sheetId: string;
  x: number;
  y: number;
  name?: string;
  alternatingColors?: boolean;
  columns?: {
    name: string;
    display: boolean;
    valueIndex: number;
  }[];
  showHeader?: boolean;
  cursor: string;
}

export interface ClientCoreDataTableMutations {
  type: 'clientCoreDataTableMutations';
  sheetId: string;
  x: number;
  y: number;
  column_to_add?: number;
  column_to_remove?: number;
  row_to_add?: number;
  row_to_remove?: number;
  cursor?: string;
}

export interface ClientCoreSortDataTable {
  type: 'clientCoreSortDataTable';
  sheetId: string;
  x: number;
  y: number;
  sort: { column_index: number; direction: string }[];
  cursor: string;
}

export interface ClientCoreDataTableFirstRowAsHeader {
  type: 'clientCoreDataTableFirstRowAsHeader';
  sheetId: string;
  x: number;
  y: number;
  firstRowAsHeader: boolean;
  cursor: string;
}

export interface CoreClientClientMessage {
  type: 'coreClientClientMessage';
  message: string;
  error: boolean;
}

export interface ClientCoreFiniteRectFromSelection {
  type: 'clientCoreFiniteRectFromSelection';
  id: number;
  selection: string;
}

export interface CoreClientFiniteRectFromSelection {
  type: 'coreClientFiniteRectFromSelection';
  id: number;
  rect?: Rectangle;
}

export type ClientCoreMessage =
  | ClientCoreLoad
  | ClientCoreGetCodeCell
  | ClientCoreCellHasContent
  | ClientCoreGetEditCell
  | ClientCoreSetCellValue
  | ClientCoreSetCellValues
  | ClientCoreGetCellFormatSummary
  | ClientCoreInitMultiplayer
  | ClientCoreSummarizeSelection
  | ClientCoreSetCellBold
  | ClientCoreSetCellItalic
  | ClientCoreSetCellFillColor
  | ClientCoreSetCellTextColor
  | ClientCoreSetCellUnderline
  | ClientCoreSetCellStrikeThrough
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
  | ClientCoreImportFile
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
  | ClientCoreSetBorders
  | ClientCoreSetCellRenderResize
  | ClientCoreAutocomplete
  | ClientCoreExportCsvSelection
  | ClientCoreGetColumnsBounds
  | ClientCoreGetRowsBounds
  | ClientCoreJumpCursor
  | ClientCoreFindNextColumn
  | ClientCoreFindNextRow
  | ClientCoreCommitTransientResize
  | ClientCoreCommitSingleResize
  | ClientCoreInit
  | ClientCoreInitPython
  | ClientCoreInitJavascript
  | ClientCoreCancelExecution
  | ClientCoreGetJwt
  | ClientCoreMoveCells
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
  | ClientCoreGetCellValue
  | ClientCoreNeighborText
  | ClientCoreDeleteColumns
  | ClientCoreDeleteRows
  | ClientCoreInsertColumn
  | ClientCoreInsertRow
  | ClientCoreFlattenDataTable
  | ClientCoreCodeDataTableToDataTable
  | ClientCoreGridToDataTable
  | ClientCoreDataTableMeta
  | ClientCoreDataTableMutations
  | ClientCoreSortDataTable
  | ClientCoreDataTableFirstRowAsHeader
  | ClientCoreGetCellValue
  | ClientCoreGetAIContextRectsInSelections
  | ClientCoreGetErroredCodeCellsInSelections
  | ClientCoreFindNextColumnForRect
  | ClientCoreFindNextRowForRect
  | ClientCoreMoveCodeCellVertically
  | ClientCoreMoveCodeCellHorizontally
  | ClientCoreFiniteRectFromSelection;

export type CoreClientMessage =
  | CoreClientGetCodeCell
  | CoreClientGetEditCell
  | CoreClientCellHasContent
  | CoreClientGetCellFormatSummary
  | CoreClientSummarizeSelection
  | CoreClientGetRenderCell
  | CoreClientImportFile
  | CoreClientAddSheet
  | CoreClientSheetInfo
  | CoreClientSheetFills
  | CoreClientDeleteSheet
  | CoreClientSheetInfoUpdate
  | CoreClientSetCursor
  | CoreClientSetCursorSelection
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
  | CoreClientJumpCursor
  | CoreClientGenerateThumbnail
  | CoreClientLoad
  | CoreClientSheetRenderCells
  | CoreClientSheetCodeCellRender
  | CoreClientSheetBoundsUpdate
  | CoreClientImportProgress
  | CoreClientTransactionStart
  | CoreClientTransactionProgress
  | CoreClientUpdateCodeCell
  | CoreClientMultiplayerState
  | CoreClientConnectionState
  | CoreClientOfflineTransactions
  | CoreClientUndoRedo
  | CoreClientGetJwt
  | CoreClientImage
  | CoreClientGetFormatCell
  | CoreClientSheetMetaFills
  | CoreClientOfflineTransactionsApplied
  | CoreClientGetValidations
  | CoreClientSheetValidations
  | CoreClientGetValidationFromPos
  | CoreClientGetValidationList
  | CoreClientGetDisplayCell
  | CoreClientRenderValidationWarnings
  | CoreClientMultiplayerSynced
  | CoreClientValidateInput
  | CoreClientGetCellValue
  | CoreClientNeighborText
  | CoreClientBordersSheet
  | CoreClientGetCellValue
  | CoreClientClientMessage
  | CoreClientGetAIContextRectsInSelections
  | CoreClientGetErroredCodeCellsInSelections
  | CoreClientFindNextColumnForRect
  | CoreClientFindNextRowForRect
  | CoreClientMoveCodeCellVertically
  | CoreClientMoveCodeCellHorizontally
  | CoreClientFiniteRectFromSelection;
