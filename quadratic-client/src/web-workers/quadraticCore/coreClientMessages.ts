import {
  CellAlign,
  CellFormatSummary,
  CodeCellLanguage,
  JsCodeCell,
  JsHtmlOutput,
  JsRenderBorders,
  JsRenderCell,
  JsRenderCodeCell,
  JsRenderFill,
  MinMax,
  SearchOptions,
  SheetBounds,
  SheetInfo,
  SheetPos,
  TransactionName,
} from '@/quadratic-core-types';
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
  grid: string;
  sequenceNumber: number;
  id: number;
}

export interface CoreClientUpgradeFile {
  type: 'coreClientUpgradeGridFile';
  grid: string;
  version: string;
  id: number;
}

export interface ClientCoreInitMultiplayer {
  type: 'clientCoreInitMultiplayer';
}

export interface CoreClientMultiplayerState {
  type: 'coreClientMultiplayerState';
  state: MultiplayerState;
}

export interface ClientCoreInitPython {
  type: 'clientCoreInitPython';
}

export interface ClientCoreExport {
  type: 'clientCoreExport';
  id: number;
}

export interface CoreClientExport {
  type: 'coreClientExport';
  grid: string;
  id: number;
}

export interface ClientCoreExportCsvSelection {
  type: 'clientCoreExportCsvSelection';
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  id: number;
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
  sheetId: string;
  x: number;
  y: number;
  id: number;
}

export interface CoreClientGetCellFormatSummary {
  type: 'coreClientGetCellFormatSummary';
  formatSummary: CellFormatSummary;
  id: number;
}

export interface ClientCoreSummarizeSelection {
  type: 'clientCoreSummarizeSelection';
  sheetId: string;
  decimalPlaces: number;
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CoreClientSummarizeSelection {
  type: 'coreClientSummarizeSelection';
  id: number;
  summary:
    | {
        count: number;
        sum: number | undefined;
        average: number | undefined;
      }
    | undefined;
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

export interface CoreClientRenderCodeCells {
  type: 'coreClientRenderCodeCells';
  sheetId: string;
  codeCells: JsRenderCodeCell[];
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
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  bold: boolean;
  cursor?: string;
}

export interface ClientCoreSetCellItalic {
  type: 'clientCoreSetCellItalic';
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  italic: boolean;
  cursor?: string;
}

export interface ClientCoreSetCellFillColor {
  type: 'clientCoreSetCellFillColor';
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor?: string;
  cursor?: string;
}

export interface ClientCoreSetCellTextColor {
  type: 'clientCoreSetCellTextColor';
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  cursor?: string;
}

export interface ClientCoreSetCellAlign {
  type: 'clientCoreSetCellAlign';
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  align?: CellAlign;
  cursor?: string;
}

export interface ClientCoreSetCurrency {
  type: 'clientCoreSetCurrency';
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  symbol: string;
  cursor?: string;
}

export interface ClientCoreSetPercentage {
  type: 'clientCoreSetPercentage';
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cursor?: string;
}

export interface ClientCoreSetExponential {
  type: 'clientCoreSetExponential';
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cursor?: string;
}

export interface ClientCoreRemoveCellNumericFormat {
  type: 'clientCoreRemoveCellNumericFormat';
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cursor?: string;
}

export interface ClientCoreChangeDecimals {
  type: 'clientCoreChangeDecimals';
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  delta: number;
  cursor?: string;
}

export interface ClientCoreClearFormatting {
  type: 'clientCoreClearFormatting';
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cursor?: string;
}

export interface ClientCoreToggleCommas {
  type: 'clientCoreToggleCommas';
  sheetId: string;
  sourceX: number;
  sourceY: number;
  x: number;
  y: number;
  width: number;
  height: number;
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
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
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
  x: number;
  y: number;
  width: number;
  height: number;
  fullX: number;
  fullY: number;
  fullWidth: number;
  fullHeight: number;
  cursor: string;
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
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
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
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
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
  sheetId: string;
  x: number;
  y: number;
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
  column: number;
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
  sheetId?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
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
  file: File;
  id: number;
}

export interface CoreClientImportExcel {
  type: 'coreClientImportExcel';
  id: number;
  contents?: string;
  version?: string;
  error?: string;
}

//#endregion

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
  | ClientCoreSetCurrency
  | ClientCoreSetPercentage
  | ClientCoreSetExponential
  | ClientCoreRemoveCellNumericFormat
  | ClientCoreChangeDecimals
  | ClientCoreClearFormatting
  | ClientCoreGetRenderCell
  | ClientCoreToggleCommas
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
  | ClientCoreInitPython
  | ClientCoreImportExcel;

export type CoreClientMessage =
  | CoreClientGetCodeCell
  | CoreClientRenderCodeCells
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
  | CoreClientSheetCodeCellRender
  | CoreClientSheetBoundsUpdate
  | CoreClientImportProgress
  | CoreClientTransactionStart
  | CoreClientTransactionProgress
  | CoreClientUpdateCodeCell
  | CoreClientImportExcel
  | CoreClientMultiplayerState;
