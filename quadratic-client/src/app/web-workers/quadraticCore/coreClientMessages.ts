import type { TimerNames } from '@/app/gridGL/helpers/startupTimer';
import type { ColumnRowResize } from '@/app/gridGL/interaction/pointer/PointerHeading';
import type {
  BorderSelection,
  BorderStyle,
  CellAlign,
  CellFormatSummary,
  CellVerticalAlign,
  CellWrap,
  CodeCellLanguage,
  DataTableSort,
  Format,
  FormatUpdate,
  JsCellValue,
  JsCodeCell,
  JsCodeErrorContext,
  JsCoordinate,
  JsDataTableColumnHeader,
  JsGetAICellResult,
  JsRenderCell,
  JsResponse,
  JsSheetNameToColor,
  JsSheetPosText,
  JsSnackbarSeverity,
  JsSummarizeSelectionResult,
  JsSummaryContext,
  Pos,
  SearchOptions,
  SheetRect,
  TrackedTransaction,
  TransactionName,
  Validation,
  ValidationUpdate,
} from '@/app/quadratic-core-types';
import type { MultiplayerState } from '@/app/web-workers/multiplayerWebWorker/multiplayerClientMessages';

//#region Initialize

export interface ClientCoreLoad {
  type: 'clientCoreLoad';
  url: string;
  version: string;
  sequenceNumber: number;
  id: number;
  fileId: string;
  teamUuid: string;
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

export interface CodeOperation {
  x: number;
  y: number;
  sheet_id: string;
  language: string;
}

export interface CodeRunningState {
  current: CodeOperation | null;
  pending: CodeOperation[];
}

export interface CoreClientCodeExecutionState {
  type: 'coreClientCodeRunningState';
  transactionId: string;
  codeRunningState: CodeRunningState;
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

export interface ClientCoreExportExcel {
  type: 'clientCoreExportExcel';
  id: number;
}

export interface CoreClientExportExcel {
  type: 'coreClientExportExcel';
  excel: Uint8Array;
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
  results: JsSheetPosText[];
  id: number;
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

export interface ClientCoreGetTeamUuid {
  type: 'clientCoreGetTeamUuid';
  id: number;
  teamUuid: string;
}

//#endregion

//#region Render

export interface CoreClientGetRenderCell {
  type: 'coreClientGetRenderCell';
  cell: JsRenderCell | undefined;
  id: number;
}

export interface CoreClientHtmlOutput {
  type: 'coreClientHtmlOutput';
  html: Uint8Array;
}

export interface CoreClientUpdateHtml {
  type: 'coreClientUpdateHtml';
  html: Uint8Array;
}

//#endregion

//#region Set values

export interface ClientCoreSetCellValue {
  type: 'clientCoreSetCellValue';
  sheetId: string;
  x: number;
  y: number;
  value: string;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreSetCellValues {
  type: 'clientCoreSetCellValues';
  id: number;
  sheetId: string;
  x: number;
  y: number;
  values: string[][];
  cursor: string;
  isAi: boolean;
}

export interface CoreClientSetCellValues {
  type: 'coreClientSetCellValues';
  id: number;
}

export interface ClientCoreSetCellRichText {
  type: 'clientCoreSetCellRichText';
  sheetId: string;
  x: number;
  y: number;
  spansJson: string;
  cursor: string;
}

export interface ClientCoreSetCellBold {
  type: 'clientCoreSetCellBold';
  selection: string;
  bold?: boolean;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreSetCellItalic {
  type: 'clientCoreSetCellItalic';
  selection: string;
  italic?: boolean;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreSetCellFontSize {
  type: 'clientCoreSetCellFontSize';
  selection: string;
  fontSize: number;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreSetCellFillColor {
  type: 'clientCoreSetCellFillColor';
  selection: string;
  fillColor?: string;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreGetRenderFillsForHashes {
  type: 'clientCoreGetRenderFillsForHashes';
  sheetId: string;
  hashes: JsCoordinate[];
}

export interface ClientCoreGetSheetMetaFills {
  type: 'clientCoreGetSheetMetaFills';
  sheetId: string;
}

export interface ClientCoreSetCellTextColor {
  type: 'clientCoreSetCellTextColor';
  selection: string;
  color?: string;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreSetCellUnderline {
  type: 'clientCoreSetCellUnderline';
  selection: string;
  underline?: boolean;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreSetCellStrikeThrough {
  type: 'clientCoreSetCellStrikeThrough';
  selection: string;
  strikeThrough?: boolean;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreSetCellAlign {
  type: 'clientCoreSetCellAlign';
  selection: string;
  align: CellAlign;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreSetCellVerticalAlign {
  type: 'clientCoreSetCellVerticalAlign';
  selection: string;
  verticalAlign: CellVerticalAlign;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreSetCellWrap {
  type: 'clientCoreSetCellWrap';
  selection: string;
  wrap: CellWrap;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreSetCurrency {
  type: 'clientCoreSetCurrency';
  selection: string;
  symbol: string;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreSetPercentage {
  type: 'clientCoreSetPercentage';
  selection: string;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreSetExponential {
  type: 'clientCoreSetExponential';
  selection: string;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreRemoveCellNumericFormat {
  type: 'clientCoreRemoveCellNumericFormat';
  selection: string;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreChangeDecimals {
  type: 'clientCoreChangeDecimals';
  selection: string;
  delta: number;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreClearFormatting {
  type: 'clientCoreClearFormatting';
  selection: string;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreSetCommas {
  type: 'clientCoreSetCommas';
  selection: string;
  commas?: boolean;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreUpgradeGridFile {
  type: 'clientCoreUpgradeGridFile';
  id: number;
  grid: ArrayBuffer;
  sequenceNumber: number;
}

export interface CoreClientUpgradeFile {
  type: 'coreClientUpgradeGridFile';
  id: number;
  contents?: ArrayBufferLike;
  version?: string;
  error?: string;
}

export interface ClientCoreImportFile {
  type: 'clientCoreImportFile';
  id: number;
  file: ArrayBufferLike;
  fileName: string;
  fileType: 'CSV' | 'Parquet' | 'Excel';
  sheetId?: string;
  location?: JsCoordinate;
  cursor?: string;
  csvDelimiter?: number;
  hasHeading?: boolean;
  isOverwrite?: boolean;
  isAi: boolean;
}

export interface CoreClientImportFile {
  type: 'coreClientImportFile';
  id: number;
  contents?: ArrayBufferLike;
  version?: string;
  error?: string;
  responsePrompt?: string;
}

export interface ClientCoreDeleteCellValues {
  type: 'clientCoreDeleteCellValues';
  id: number;
  selection: string;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientDeleteCellValues {
  type: 'coreClientDeleteCellValues';
  id: number;
  response: JsResponse | undefined;
}

export interface ClientCoreSetCodeCellValue {
  type: 'clientCoreSetCodeCellValue';
  id: number;
  sheetId: string;
  x: number;
  y: number;
  language: CodeCellLanguage;
  codeString: string;
  cursor: string;
  codeCellName?: string;
  isAi: boolean;
}

export interface CoreClientSetCodeCellValue {
  type: 'coreClientSetCodeCellValue';
  id: number;
  transactionId: string | undefined;
  error?: string;
}

export interface CoreClientHashRenderFills {
  type: 'coreClientHashRenderFills';
  hashRenderFills: Uint8Array;
}

export interface CoreClientHashesDirtyFills {
  type: 'coreClientHashesDirtyFills';
  dirtyHashes: Uint8Array;
}

export interface CoreClientSheetMetaFills {
  type: 'coreClientSheetMetaFills';
  sheetId: string;
  fills: Uint8Array;
}

export interface ClientCoreRerunCodeCells {
  type: 'clientCoreRerunCodeCells';
  id: number;
  sheetId?: string;
  selection?: string;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientRerunCodeCells {
  type: 'coreClientRerunCodeCells';
  id: number;
  response: string | JsResponse | undefined;
}

export interface ClientCoreSetBorders {
  type: 'clientCoreSetBorders';
  id: number;
  selection: string;
  borderSelection: BorderSelection;
  style?: BorderStyle;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientSetBorders {
  type: 'coreClientSetBorders';
  id: number;
  response: JsResponse | undefined;
}

export interface ClientCoreSetCellRenderResize {
  type: 'clientCoreSetCellRenderResize';
  id: number;
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientSetCellRenderResize {
  type: 'coreClientSetCellRenderResize';
  id: number;
  response: JsResponse | undefined;
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
  isAi: boolean;
}

export interface ClientCoreUpdateValidation {
  type: 'clientCoreUpdateValidation';
  id: number;
  validation: ValidationUpdate;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientUpdateValidation {
  type: 'coreClientUpdateValidation';
  id: number;
  response: JsResponse | undefined;
}

export interface ClientCoreRemoveValidation {
  type: 'clientCoreRemoveValidation';
  sheetId: string;
  validationId: string;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreRemoveValidations {
  type: 'clientCoreRemoveValidations';
  sheetId: string;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreGetValidationFromPos {
  type: 'clientCoreGetValidationFromPos';
  id: number;
  sheetId: string;
  x: number;
  y: number;
}

//#endregion

//#region Sheets

export interface CoreClientSheetsInfo {
  type: 'coreClientSheetsInfo';
  sheetsInfo: Uint8Array;
}

export interface CoreClientSheetBoundsUpdate {
  type: 'coreClientSheetBoundsUpdate';
  sheetBounds: Uint8Array;
}

export interface ClientCoreAddSheet {
  type: 'clientCoreAddSheet';
  id: number;
  sheetName?: string;
  insertBeforeSheetName?: string;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientAddSheetResponse {
  type: 'coreClientAddSheetResponse';
  id: number;
  response: JsResponse | undefined;
}

export interface CoreClientAddSheet {
  type: 'coreClientAddSheet';
  sheetInfo: Uint8Array;
  user: boolean;
}

export interface ClientCoreDuplicateSheet {
  type: 'clientCoreDuplicateSheet';
  id: number;
  sheetId: string;
  nameOfNewSheet?: string;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientDuplicateSheetResponse {
  type: 'coreClientDuplicateSheetResponse';
  id: number;
  response: JsResponse | undefined;
}

export interface ClientCoreDeleteSheet {
  type: 'clientCoreDeleteSheet';
  id: number;
  sheetId: string;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientDeleteSheetResponse {
  type: 'coreClientDeleteSheetResponse';
  id: number;
  response: JsResponse | undefined;
}

export interface CoreClientDeleteSheet {
  type: 'coreClientDeleteSheet';
  sheetId: string;
  user: boolean;
}

export interface ClientCoreMoveSheet {
  type: 'clientCoreMoveSheet';
  id: number;
  sheetId: string;
  previous?: string;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientMoveSheetResponse {
  type: 'coreClientMoveSheetResponse';
  id: number;
  response: JsResponse | undefined;
}

export interface CoreClientSheetInfoUpdate {
  type: 'coreClientSheetInfoUpdate';
  sheetInfo: Uint8Array;
}

export interface ClientCoreSetSheetName {
  type: 'clientCoreSetSheetName';
  id: number;
  sheetId: string;
  name: string;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientSetSheetNameResponse {
  type: 'coreClientSetSheetNameResponse';
  id: number;
  response: JsResponse | undefined;
}

export interface ClientCoreSetSheetColor {
  type: 'clientCoreSetSheetColor';
  id: number;
  sheetId: string;
  color: string | undefined;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientSetSheetColorResponse {
  type: 'coreClientSetSheetColorResponse';
  id: number;
  response: JsResponse | undefined;
}

export interface ClientCoreSetSheetsColor {
  type: 'clientCoreSetSheetsColor';
  id: number;
  sheetNameToColor: JsSheetNameToColor[];
  cursor: string;
  isAi: boolean;
}

export interface CoreClientSetSheetsColorResponse {
  type: 'coreClientSetSheetsColorResponse';
  id: number;
  response: JsResponse | undefined;
}

export interface CoreClientSetCursor {
  type: 'coreClientSetCursor';
  cursor: string;
}

export interface CoreClientSheetOffsets {
  type: 'coreClientSheetOffsets';
  sheetId: string;
  offsets: Uint8Array;
}

export interface CoreClientGenerateThumbnail {
  type: 'coreClientGenerateThumbnail';
}

export interface CoreClientBordersSheet {
  type: 'coreClientBordersSheet';
  sheetId: string;
  borders: Uint8Array;
}

export interface CoreClientSheetCodeCellRender {
  type: 'coreClientSheetCodeCells';
  sheetId: string;
  renderCodeCells: Uint8Array;
}

//#endregion

//#region Undo/Redo

export interface ClientCoreUndo {
  type: 'clientCoreUndo';
  id: number;
  count: number;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreRedo {
  type: 'clientCoreRedo';
  id: number;
  count: number;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientUndoResponse {
  type: 'coreClientUndoResponse';
  id: number;
  response: string | undefined;
}

export interface CoreClientRedoResponse {
  type: 'coreClientRedoResponse';
  id: number;
  response: string | undefined;
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
  data: Uint8Array | undefined;
}

export interface ClientCoreCutToClipboard {
  type: 'clientCoreCutToClipboard';
  id: number;
  selection: string;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientCutToClipboard {
  type: 'coreClientCutToClipboard';
  id: number;
  data: Uint8Array | undefined;
}

export interface ClientCorePasteFromClipboard {
  type: 'clientCorePasteFromClipboard';
  selection: string;
  jsClipboard: Uint8Array;
  special: string;
  cursor: string;
  isAi: boolean;
}

//#endregion

//#region Bounds

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
  isAi: boolean;
}

export interface ClientCoreCommitSingleResize {
  type: 'clientCoreCommitSingleResize';
  sheetId: string;
  column: number | undefined;
  row: number | undefined;
  size: number;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreHasCellData {
  type: 'clientCoreHasCellData';
  id: number;
  sheetId: string;
  selection: string;
}

export interface CoreClientHasCellData {
  type: 'coreClientHasCellData';
  id: number;
  hasData: boolean;
}

//#endregion

//#region transactions

export interface CoreClientImportProgress {
  type: 'coreClientImportProgress';
  filename: string;
  current: number;
  total: number;
}

export interface CoreClientTransactionStart {
  type: 'coreClientTransactionStart';
  transactionId: string;
  transactionName: TransactionName;
}

export interface CoreClientTransactionEnd {
  type: 'coreClientTransactionEnd';
  transactionId: string;
  transactionName: TransactionName;
}

export interface CoreClientUpdateCodeCells {
  type: 'coreClientUpdateCodeCells';
  updateCodeCells: Uint8Array;
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

export interface ClientCoreMoveColsRows {
  type: 'clientCoreMoveColsRows';
  id: number;
  source: SheetRect;
  targetSheetId: string;
  targetX: number;
  targetY: number;
  columns: boolean;
  rows: boolean;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientMoveColsRows {
  type: 'coreClientMoveColsRows';
  id: number;
}

export interface MoveItem {
  source: SheetRect;
  dest: { x: number; y: number; sheet_id: { id: string } };
}

export interface ClientCoreMoveCellsBatch {
  type: 'clientCoreMoveCellsBatch';
  id: number;
  moves: MoveItem[];
  cursor: string;
  isAi: boolean;
}

export interface CoreClientMoveCellsBatch {
  type: 'coreClientMoveCellsBatch';
  id: number;
}

export interface ClientCoreMoveCodeCellVertically {
  type: 'clientCoreMoveCodeCellVertically';
  id: number;
  sheetId: string;
  x: number;
  y: number;
  sheetEnd: boolean;
  reverse: boolean;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientMoveCodeCellVertically {
  type: 'coreClientMoveCodeCellVertically';
  id: number;
  pos: Pos | undefined;
}

export interface ClientCoreMoveCodeCellHorizontally {
  type: 'clientCoreMoveCodeCellHorizontally';
  id: number;
  sheetId: string;
  x: number;
  y: number;
  sheetEnd: boolean;
  reverse: boolean;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientMoveCodeCellHorizontally {
  type: 'coreClientMoveCodeCellHorizontally';
  id: number;
  pos: Pos | undefined;
}

//#endregion

export interface CoreClientImage {
  type: 'coreClientImage';
  sheetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  image?: string;
  pixel_width?: number;
  pixel_height?: number;
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
  sheetValidations: Uint8Array;
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

export interface CoreClientValidationWarnings {
  type: 'coreClientValidationWarnings';
  warnings: Uint8Array;
}

export interface CoreClientMultiplayerSynced {
  type: 'coreClientMultiplayerSynced';
}

export interface ClientCoreSetDateTimeFormat {
  type: 'clientCoreSetDateTimeFormat';
  selection: string;
  format: string;
  cursor: string;
  isAi: boolean;
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

export interface ClientCoreGetAISelectionContexts {
  type: 'clientCoreGetAISelectionContexts';
  id: number;
  selections: string[];
  maxRows: number | undefined;
}

export interface CoreClientGetAISelectionContexts {
  type: 'coreClientGetAISelectionContexts';
  id: number;
  summaryContexts: JsSummaryContext[] | undefined;
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
  id: number;
  sheetId: string;
  columns: number[];
  cursor: string;
  isAi: boolean;
}

export interface CoreClientDeleteColumns {
  type: 'coreClientDeleteColumns';
  id: number;
  response: JsResponse | undefined;
}

export interface ClientCoreDeleteRows {
  type: 'clientCoreDeleteRows';
  id: number;
  sheetId: string;
  rows: number[];
  cursor: string;
  isAi: boolean;
}

export interface CoreClientDeleteRows {
  type: 'coreClientDeleteRows';
  id: number;
  response: JsResponse | undefined;
}

export interface ClientCoreInsertColumns {
  type: 'clientCoreInsertColumns';
  id: number;
  sheetId: string;
  column: number;
  count: number;
  right: boolean;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientInsertColumns {
  type: 'coreClientInsertColumns';
  id: number;
  response: JsResponse | undefined;
}

export interface ClientCoreInsertRows {
  type: 'clientCoreInsertRows';
  id: number;
  sheetId: string;
  row: number;
  count: number;
  below: boolean;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientInsertRows {
  type: 'coreClientInsertRows';
  id: number;
  response: JsResponse | undefined;
}

export interface ClientCoreFlattenDataTable {
  type: 'clientCoreFlattenDataTable';
  sheetId: string;
  x: number;
  y: number;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreCodeDataTableToDataTable {
  type: 'clientCoreCodeDataTableToDataTable';
  sheetId: string;
  x: number;
  y: number;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreGridToDataTable {
  type: 'clientCoreGridToDataTable';
  id: number;
  sheetRect: string;
  tableName?: string;
  firstRowIsHeader: boolean;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientGridToDataTable {
  type: 'coreClientGridToDataTable';
  id: number;
  response: JsResponse | undefined;
}

export interface ClientCoreDataTableMeta {
  type: 'clientCoreDataTableMeta';
  id: number;
  sheetId: string;
  x: number;
  y: number;
  name?: string;
  alternatingColors?: boolean;
  columns?: JsDataTableColumnHeader[];
  showName?: boolean;
  showColumns?: boolean;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientDataTableMeta {
  type: 'coreClientDataTableMeta';
  id: number;
  response: JsResponse | undefined;
}

export interface ClientCoreDataTableMutations {
  type: 'clientCoreDataTableMutations';
  id: number;
  sheetId: string;
  x: number;
  y: number;
  select_table: boolean;
  columns_to_add?: number[];
  columns_to_remove?: number[];
  rows_to_add?: number[];
  rows_to_remove?: number[];
  flatten_on_delete?: boolean;
  swallow_on_insert?: boolean;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientDataTableMutations {
  type: 'coreClientDataTableMutations';
  id: number;
  response: JsResponse | undefined;
}

export interface ClientCoreSortDataTable {
  type: 'clientCoreSortDataTable';
  sheetId: string;
  x: number;
  y: number;
  sort?: DataTableSort[];
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreDataTableFirstRowAsHeader {
  type: 'clientCoreDataTableFirstRowAsHeader';
  id: number;
  sheetId: string;
  x: number;
  y: number;
  firstRowAsHeader: boolean;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientDataTableFirstRowAsHeader {
  type: 'coreClientDataTableFirstRowAsHeader';
  id: number;
  response: JsResponse | undefined;
}

export interface CoreClientClientMessage {
  type: 'coreClientClientMessage';
  message: string;
  severity: JsSnackbarSeverity;
}

export interface CoreClientA1Context {
  type: 'coreClientA1Context';
  context: Uint8Array;
}

export interface ClientCoreAddDataTable {
  type: 'clientCoreAddDataTable';
  id: number;
  sheetId: string;
  x: number;
  y: number;
  name: string;
  values: string[][];
  firstRowIsHeader: boolean;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientAddDataTable {
  type: 'coreClientAddDataTable';
  id: number;
}

export interface ClientCoreMoveColumns {
  type: 'clientCoreMoveColumns';
  sheetId: string;
  colStart: number;
  colEnd: number;
  to: number;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreMoveRows {
  type: 'clientCoreMoveRows';
  sheetId: string;
  rowStart: number;
  rowEnd: number;
  to: number;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientCoreError {
  type: 'coreClientCoreError';
  from: string;
  error: Error | unknown;
}

export interface ClientCoreGetAICells {
  type: 'clientCoreGetAICells';
  id: number;
  selection: string;
  sheetId: string;
  page: number;
}

export interface CoreClientGetAICells {
  type: 'coreClientGetAICells';
  id: number;
  aiCells: string | JsResponse | JsGetAICellResult | undefined;
}

export interface ClientCoreSetFormats {
  type: 'clientCoreSetFormats';
  id: number;
  sheetId: string;
  selection: string;
  formats: FormatUpdate;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientSetFormats {
  type: 'coreClientSetFormats';
  id: number;
  response: JsResponse | undefined;
}

export interface ClientCoreSetFormatsA1 {
  type: 'clientCoreSetFormatsA1';
  id: number;
  formatEntries: { sheetId: string; selection: string; formats: FormatUpdate }[];
  cursor: string;
  isAi: boolean;
}

export interface CoreClientSetFormatsA1 {
  type: 'coreClientSetFormatsA1';
  id: number;
  response: JsResponse | undefined;
}

export interface ClientCoreGetAIFormats {
  type: 'clientCoreGetAIFormats';
  id: number;
  sheetId: string;
  selection: string;
  page: number;
}

export interface CoreClientGetAIFormats {
  type: 'coreClientGetAIFormats';
  id: number;
  formats: string | JsResponse | undefined;
}

export interface ClientCoreResizeColumns {
  type: 'clientCoreResizeColumns';
  id: number;
  sheetId: string;
  columns: ColumnRowResize[];
  cursor: string;
  isAi: boolean;
}

export interface CoreClientResizeColumns {
  type: 'coreClientResizeColumns';
  id: number;
  response: JsResponse | undefined;
}

export interface ClientCoreResizeRows {
  type: 'clientCoreResizeRows';
  id: number;
  sheetId: string;
  rows: ColumnRowResize[];
  cursor: string;
  isAi: boolean;
  clientResized: boolean;
}

export interface CoreClientResizeRows {
  type: 'coreClientResizeRows';
  id: number;
  response: JsResponse | undefined;
}

export interface ClientCoreResizeAllColumns {
  type: 'clientCoreResizeAllColumns';
  sheetId: string;
  size: number;
  cursor: string;
  isAi: boolean;
}

export interface ClientCoreResizeAllRows {
  type: 'clientCoreResizeAllRows';
  sheetId: string;
  size: number;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientDataTablesCache {
  type: 'coreClientDataTablesCache';
  sheetId: string;
  dataTablesCache: Uint8Array;
}

export interface CoreClientContentCache {
  type: 'coreClientContentCache';
  sheetId: string;
  contentCache: Uint8Array;
}

export interface ClientCoreGetFormatSelection {
  type: 'clientCoreGetFormatSelection';
  id: number;
  selection: string;
}

export interface CoreClientGetFormatSelection {
  type: 'coreClientGetFormatSelection';
  id: number;
  format: CellFormatSummary | JsResponse | undefined;
}

export interface ClientCoreRemoveValidationSelection {
  type: 'clientCoreRemoveValidationSelection';
  id: number;
  sheetId: string;
  selection: string;
  cursor: string;
  isAi: boolean;
}

export interface CoreClientRemoveValidationSelection {
  type: 'coreClientRemoveValidationSelection';
  id: number;
  response: JsResponse | undefined;
}

export interface ClientCoreGetAICodeErrors {
  type: 'clientCoreGetAICodeErrors';
  id: number;
  maxErrors: number;
}

export interface CoreClientGetAICodeErrors {
  type: 'coreClientGetAICodeErrors';
  id: number;
  errors: Map<string, JsCodeErrorContext[]> | undefined;
}

export interface ClientCoreGetAITransactions {
  type: 'clientCoreGetAITransactions';
  id: number;
}

export interface CoreClientGetAITransactions {
  type: 'coreClientGetAITransactions';
  id: number;
  transactions: TrackedTransaction[] | undefined;
}

export interface CoreClientStartupTimer {
  type: 'coreClientStartupTimer';
  name: TimerNames;
  start?: number;
  end?: number;
}

export interface ClientCoreSetFormula {
  type: 'clientCoreSetFormula';
  id: number;
  sheetId: string;
  selection: string;
  codeString: string;
  cursor: string;
}

export interface CoreClientSetFormula {
  type: 'coreClientSetFormula';
  id: number;
  transactionId: string | undefined;
  error?: string;
}

export interface ClientCoreSetFormulas {
  type: 'clientCoreSetFormulas';
  id: number;
  sheetId: string;
  formulas: Array<[string, string]>; // [selection, formula_string]
  cursor: string;
}

export interface CoreClientSetFormulas {
  type: 'coreClientSetFormulas';
  id: number;
  transactionId: string | undefined;
  error?: string;
}

export type ClientCoreMessage =
  | ClientCoreLoad
  | ClientCoreGetCodeCell
  | ClientCoreGetEditCell
  | ClientCoreSetCellValue
  | ClientCoreSetCellValues
  | ClientCoreSetCellRichText
  | ClientCoreGetCellFormatSummary
  | ClientCoreInitMultiplayer
  | ClientCoreSummarizeSelection
  | ClientCoreSetCellBold
  | ClientCoreSetCellItalic
  | ClientCoreSetCellFontSize
  | ClientCoreSetCellFillColor
  | ClientCoreGetRenderFillsForHashes
  | ClientCoreGetSheetMetaFills
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
  | ClientCoreSetCommas
  | ClientCoreImportFile
  | ClientCoreDeleteCellValues
  | ClientCoreSetCodeCellValue
  | ClientCoreAddSheet
  | ClientCoreDeleteSheet
  | ClientCoreMoveSheet
  | ClientCoreSetSheetName
  | ClientCoreSetSheetColor
  | ClientCoreSetSheetsColor
  | ClientCoreDuplicateSheet
  | ClientCoreUndo
  | ClientCoreRedo
  | ClientCoreUpgradeGridFile
  | ClientCoreExport
  | ClientCoreExportExcel
  | ClientCoreSearch
  | ClientCoreRerunCodeCells
  | ClientCoreCopyToClipboard
  | ClientCoreCutToClipboard
  | ClientCorePasteFromClipboard
  | ClientCoreSetBorders
  | ClientCoreSetCellRenderResize
  | ClientCoreAutocomplete
  | ClientCoreExportCsvSelection
  | ClientCoreCommitTransientResize
  | ClientCoreCommitSingleResize
  | ClientCoreInit
  | ClientCoreInitPython
  | ClientCoreInitJavascript
  | ClientCoreCancelExecution
  | ClientCoreGetJwt
  | ClientCoreGetTeamUuid
  | ClientCoreMoveColsRows
  | ClientCoreMoveCellsBatch
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
  | ClientCoreInsertColumns
  | ClientCoreInsertRows
  | ClientCoreFlattenDataTable
  | ClientCoreCodeDataTableToDataTable
  | ClientCoreGridToDataTable
  | ClientCoreDataTableMeta
  | ClientCoreDataTableMutations
  | ClientCoreSortDataTable
  | ClientCoreDataTableFirstRowAsHeader
  | ClientCoreGetCellValue
  | ClientCoreGetAISelectionContexts
  | ClientCoreMoveCodeCellVertically
  | ClientCoreMoveCodeCellHorizontally
  | ClientCoreAddDataTable
  | ClientCoreMoveColumns
  | ClientCoreMoveRows
  | ClientCoreGetAICells
  | ClientCoreSetFormats
  | ClientCoreSetFormatsA1
  | ClientCoreGetAIFormats
  | ClientCoreResizeColumns
  | ClientCoreResizeRows
  | ClientCoreResizeAllColumns
  | ClientCoreResizeAllRows
  | ClientCoreGetFormatSelection
  | ClientCoreHasCellData
  | ClientCoreRemoveValidationSelection
  | ClientCoreGetAICodeErrors
  | ClientCoreGetAITransactions
  | ClientCoreUndo
  | ClientCoreRedo
  | ClientCoreSetFormula
  | ClientCoreSetFormulas;

export type CoreClientMessage =
  | CoreClientGetCodeCell
  | CoreClientGetEditCell
  | CoreClientGetCellFormatSummary
  | CoreClientSummarizeSelection
  | CoreClientGetRenderCell
  | CoreClientImportFile
  | CoreClientAddSheet
  | CoreClientSheetsInfo
  | CoreClientHashRenderFills
  | CoreClientHashesDirtyFills
  | CoreClientDeleteSheet
  | CoreClientSheetInfoUpdate
  | CoreClientSetCursor
  | CoreClientSheetOffsets
  | CoreClientUpgradeFile
  | CoreClientExport
  | CoreClientExportExcel
  | CoreClientSearch
  | CoreClientCopyToClipboard
  | CoreClientCutToClipboard
  | CoreClientHtmlOutput
  | CoreClientUpdateHtml
  | CoreClientExportCsvSelection
  | CoreClientGenerateThumbnail
  | CoreClientLoad
  | CoreClientSheetCodeCellRender
  | CoreClientSheetBoundsUpdate
  | CoreClientImportProgress
  | CoreClientTransactionStart
  | CoreClientTransactionEnd
  | CoreClientUpdateCodeCells
  | CoreClientMultiplayerState
  | CoreClientCodeExecutionState
  | CoreClientOfflineTransactions
  | CoreClientOfflineTransactionsApplied
  | CoreClientUndoRedo
  | CoreClientGetJwt
  | CoreClientImage
  | CoreClientGetFormatCell
  | CoreClientSheetMetaFills
  | CoreClientGetValidations
  | CoreClientSheetValidations
  | CoreClientGetValidationFromPos
  | CoreClientGetValidationList
  | CoreClientGetDisplayCell
  | CoreClientValidationWarnings
  | CoreClientMultiplayerSynced
  | CoreClientValidateInput
  | CoreClientGetCellValue
  | CoreClientNeighborText
  | CoreClientBordersSheet
  | CoreClientGetCellValue
  | CoreClientClientMessage
  | CoreClientGetAISelectionContexts
  | CoreClientMoveCodeCellVertically
  | CoreClientMoveCodeCellHorizontally
  | CoreClientA1Context
  | CoreClientAddDataTable
  | CoreClientSetCellValues
  | CoreClientMoveColsRows
  | CoreClientMoveCellsBatch
  | CoreClientDeleteCellValues
  | CoreClientDataTableMutations
  | CoreClientSetCodeCellValue
  | CoreClientCoreError
  | CoreClientGetAICells
  | CoreClientSetFormats
  | CoreClientSetFormatsA1
  | CoreClientGetAIFormats
  | CoreClientGridToDataTable
  | CoreClientDataTablesCache
  | CoreClientContentCache
  | CoreClientSetCellRenderResize
  | CoreClientGetFormatSelection
  | CoreClientHasCellData
  | CoreClientAddSheetResponse
  | CoreClientDeleteSheetResponse
  | CoreClientMoveSheetResponse
  | CoreClientSetSheetNameResponse
  | CoreClientSetSheetColorResponse
  | CoreClientSetSheetsColorResponse
  | CoreClientDuplicateSheetResponse
  | CoreClientRerunCodeCells
  | CoreClientResizeColumns
  | CoreClientResizeRows
  | CoreClientSetBorders
  | CoreClientDeleteColumns
  | CoreClientDeleteRows
  | CoreClientInsertColumns
  | CoreClientInsertRows
  | CoreClientDataTableFirstRowAsHeader
  | CoreClientDataTableMeta
  | CoreClientUpdateValidation
  | CoreClientRemoveValidationSelection
  | CoreClientGetAICodeErrors
  | CoreClientGetAITransactions
  | CoreClientUndoResponse
  | CoreClientRedoResponse
  | CoreClientStartupTimer
  | CoreClientSetFormula
  | CoreClientSetFormulas;
