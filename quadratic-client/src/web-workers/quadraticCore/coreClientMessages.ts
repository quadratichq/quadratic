import {
  CellAlign,
  CellFormatSummary,
  CodeCellLanguage,
  JsCodeCell,
  JsHtmlOutput,
  JsRenderCell,
  JsRenderCodeCell,
  JsRenderFill,
  SearchOptions,
  SheetInfo,
  SheetPos,
} from '@/quadratic-core-types';

//#region Initialize

export interface ClientCoreLoad {
  type: 'clientCoreLoad';
  url: string;
  version: string;
  sequenceNumber: number;
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

export interface ClientCoreExport {
  type: 'clientCoreExport';
  id: number;
}

export interface CoreClientExport {
  type: 'coreClientExport';
  grid: string;
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

export interface ClientCoreGetGridBounds {
  type: 'clientCoreGetGridBounds';
  sheetId: string;
  id: number;
  ignoreFormatting: boolean;
}

export interface CoreClientGetGridBounds {
  type: 'coreClientGetGridBounds';
  bounds?: { x: number; y: number; width: number; height: number };
  id: number;
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

export interface ClientCoreGetRenderCodeCells {
  type: 'clientCoreGetRenderCodeCells';
  sheetId: string;
  id: number;
}

export interface CoreClientGetRenderCodeCells {
  type: 'coreClientGetRenderCodeCells';
  codeCells: JsRenderCodeCell[];
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

export type ClientCoreMessage =
  | ClientCoreLoad
  | ClientCoreGetCodeCell
  | ClientCoreGetRenderCodeCells
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
  | ClientCoreGetGridBounds
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
  | ClientCoreAutocomplete;

export type CoreClientMessage =
  | CoreClientGetCodeCell
  | CoreClientGetRenderCodeCells
  | CoreClientGetEditCell
  | CoreClientCellHasContent
  | CoreClientGetCellFormatSummary
  | CoreClientSummarizeSelection
  | CoreClientGetRenderCell
  | CoreClientImportCsv
  | CoreClientGetGridBounds
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
  | CoreClientUpdateHtml;
