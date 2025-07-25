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
  JsCoordinate,
  JsDataTableColumnHeader,
  JsRenderCell,
  JsResponse,
  JsSelectionContext,
  JsSheetNameToColor,
  JsSheetPosText,
  JsSnackbarSeverity,
  JsSummarizeSelectionResult,
  JsTablesContext,
  Pos,
  SearchOptions,
  SheetRect,
  TransactionName,
  Validation,
} from '@/app/quadratic-core-types';
import type { CodeRun } from '@/app/web-workers/CodeRun';
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
  cursor?: string;
}

export interface ClientCoreSetCellValues {
  type: 'clientCoreSetCellValues';
  sheetId: string;
  x: number;
  y: number;
  values: string[][];
  cursor?: string;
  id: number;
}

export interface CoreClientSetCellValues {
  type: 'coreClientSetCellValues';
  id: number;
}

export interface ClientCoreSetCellBold {
  type: 'clientCoreSetCellBold';
  selection: string;
  bold?: boolean;
  cursor?: string;
}

export interface ClientCoreSetCellItalic {
  type: 'clientCoreSetCellItalic';
  selection: string;
  italic?: boolean;
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
  underline?: boolean;
  cursor?: string;
}

export interface ClientCoreSetCellStrikeThrough {
  type: 'clientCoreSetCellStrikeThrough';
  selection: string;
  strikeThrough?: boolean;
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
  commas?: boolean;
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
  contents?: ArrayBufferLike;
  version?: string;
  error?: string;
}

export interface ClientCoreImportFile {
  type: 'clientCoreImportFile';
  file: ArrayBufferLike;
  fileName: string;
  fileType: 'csv' | 'parquet' | 'excel';
  sheetId?: string;
  location?: JsCoordinate;
  cursor?: string;
  id: number;
  csvDelimiter?: number;
  hasHeading?: boolean;
}

export interface CoreClientImportFile {
  type: 'coreClientImportFile';
  id: number;
  contents?: ArrayBufferLike;
  version?: string;
  error?: string;
}

export interface ClientCoreDeleteCellValues {
  type: 'clientCoreDeleteCellValues';
  selection: string;
  cursor?: string;
  id: number;
}

export interface CoreClientDeleteCellValues {
  type: 'coreClientDeleteCellValues';
  id: number;
  response: JsResponse | undefined;
}

export interface ClientCoreSetCodeCellValue {
  type: 'clientCoreSetCodeCellValue';
  sheetId: string;
  x: number;
  y: number;
  language: CodeCellLanguage;
  codeString: string;
  cursor?: string;
  id: number;
  codeCellName?: string;
}

export interface CoreClientSetCodeCellValue {
  type: 'coreClientSetCodeCellValue';
  id: number;
  transactionId: string | undefined;
}

export interface CoreClientSheetFills {
  type: 'coreClientSheetFills';
  sheetId: string;
  fills: Uint8Array;
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
}

export interface CoreClientSetBorders {
  type: 'coreClientSetBorders';
  id: number;
  response: JsResponse | undefined;
}

export interface ClientCoreSetCellRenderResize {
  type: 'clientCoreSetCellRenderResize';
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cursor: string;
  id: number;
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
  cursor?: string;
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
  data: Uint8Array | undefined;
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
  data: Uint8Array | undefined;
}

export interface ClientCorePasteFromClipboard {
  type: 'clientCorePasteFromClipboard';
  selection: string;
  jsClipboard: Uint8Array;
  special: string;
  cursor: string;
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
}

export interface ClientCoreCommitSingleResize {
  type: 'clientCoreCommitSingleResize';
  sheetId: string;
  column: number | undefined;
  row: number | undefined;
  size: number;
  cursor: string;
}

export interface ClientCoreHasCellData {
  type: 'clientCoreHasCellData';
  sheetId: string;
  selection: string;
  id: number;
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

export interface ClientCoreMoveCells {
  type: 'clientCoreMoveCells';
  id: number;
  source: SheetRect;
  targetSheetId: string;
  targetX: number;
  targetY: number;
  columns: boolean;
  rows: boolean;
  cursor: string;
}

export interface CoreClientMoveCells {
  type: 'coreClientMoveCells';
  id: number;
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
  pos: Pos | undefined;
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
  pos: Pos | undefined;
  id: number;
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
  maxRects: number | undefined;
  includeErroredCodeCells: boolean;
  includeTablesSummary: boolean;
  includeChartsSummary: boolean;
}

export interface CoreClientGetAISelectionContexts {
  type: 'coreClientGetAISelectionContexts';
  id: number;
  selectionContexts: JsSelectionContext[] | undefined;
}

export interface ClientCoreGetAITablesContext {
  type: 'clientCoreGetAITablesContext';
  id: number;
}

export interface CoreClientGetAITablesContext {
  type: 'coreClientGetAITablesContext';
  id: number;
  tablesContext: JsTablesContext[] | undefined;
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

export interface ClientCoreInsertColumns {
  type: 'clientCoreInsertColumns';
  sheetId: string;
  column: number;
  count: number;
  right: boolean;
  cursor: string;
}

export interface ClientCoreInsertRows {
  type: 'clientCoreInsertRows';
  sheetId: string;
  row: number;
  count: number;
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
  id: number;
  sheetRect: string;
  tableName?: string;
  firstRowIsHeader: boolean;
  cursor: string;
}

export interface CoreClientGridToDataTable {
  type: 'coreClientGridToDataTable';
  id: number;
  response: JsResponse | undefined;
}

export interface ClientCoreDataTableMeta {
  type: 'clientCoreDataTableMeta';
  sheetId: string;
  x: number;
  y: number;
  name?: string;
  alternatingColors?: boolean;
  columns?: JsDataTableColumnHeader[];
  showName?: boolean;
  showColumns?: boolean;
  cursor: string;
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
  cursor?: string;
}

export interface CoreClientDataTableMutations {
  type: 'coreClientDataTableMutations';
  id: number;
}

export interface ClientCoreSortDataTable {
  type: 'clientCoreSortDataTable';
  sheetId: string;
  x: number;
  y: number;
  sort?: DataTableSort[];
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
}

export interface ClientCoreMoveRows {
  type: 'clientCoreMoveRows';
  sheetId: string;
  rowStart: number;
  rowEnd: number;
  to: number;
  cursor: string;
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
  aiCells: string | JsResponse | undefined;
}

export interface ClientCoreSetFormats {
  type: 'clientCoreSetFormats';
  sheetId: string;
  selection: string;
  formats: FormatUpdate;
  id: number;
}

export interface CoreClientSetFormats {
  type: 'coreClientSetFormats';
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
}

export interface ClientCoreResizeAllRows {
  type: 'clientCoreResizeAllRows';
  sheetId: string;
  size: number;
  cursor: string;
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

export type ClientCoreMessage =
  | ClientCoreLoad
  | ClientCoreGetCodeCell
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
  | ClientCoreGetAITablesContext
  | ClientCoreMoveCodeCellVertically
  | ClientCoreMoveCodeCellHorizontally
  | ClientCoreAddDataTable
  | ClientCoreMoveColumns
  | ClientCoreMoveRows
  | ClientCoreGetAICells
  | ClientCoreSetFormats
  | ClientCoreGetAIFormats
  | ClientCoreResizeColumns
  | ClientCoreResizeRows
  | ClientCoreResizeAllColumns
  | ClientCoreResizeAllRows
  | ClientCoreGetFormatSelection
  | ClientCoreHasCellData;

export type CoreClientMessage =
  | CoreClientGetCodeCell
  | CoreClientGetEditCell
  | CoreClientGetCellFormatSummary
  | CoreClientSummarizeSelection
  | CoreClientGetRenderCell
  | CoreClientImportFile
  | CoreClientAddSheet
  | CoreClientSheetsInfo
  | CoreClientSheetFills
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
  | CoreClientValidationWarnings
  | CoreClientMultiplayerSynced
  | CoreClientValidateInput
  | CoreClientGetCellValue
  | CoreClientNeighborText
  | CoreClientBordersSheet
  | CoreClientGetCellValue
  | CoreClientClientMessage
  | CoreClientGetAISelectionContexts
  | CoreClientGetAITablesContext
  | CoreClientMoveCodeCellVertically
  | CoreClientMoveCodeCellHorizontally
  | CoreClientA1Context
  | CoreClientAddDataTable
  | CoreClientSetCellValues
  | CoreClientMoveCells
  | CoreClientDeleteCellValues
  | CoreClientDataTableMutations
  | CoreClientSetCodeCellValue
  | CoreClientCoreError
  | CoreClientGetAICells
  | CoreClientSetFormats
  | CoreClientGetAIFormats
  | CoreClientGridToDataTable
  | CoreClientDataTablesCache
  | CoreClientContentCache
  | CoreClientSetCellRenderResize
  | CoreClientGetFormatSelection
  | CoreClientAddSheetResponse
  | CoreClientDeleteSheetResponse
  | CoreClientMoveSheetResponse
  | CoreClientSetSheetNameResponse
  | CoreClientSetSheetColorResponse
  | CoreClientSetSheetsColorResponse
  | CoreClientDuplicateSheetResponse
  | CoreClientHasCellData
  | CoreClientRerunCodeCells
  | CoreClientResizeColumns
  | CoreClientResizeRows
  | CoreClientSetBorders;
