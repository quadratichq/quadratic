import type { ContextMenuState } from '@/app/atoms/contextMenuAtom';
import type { ErrorValidation } from '@/app/gridGL/cells/CellsSheet';
import type { EditingCell } from '@/app/gridGL/HTMLGrid/hoverCell/HoverCell';
import type { CursorMode } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorKeyboard';
import type { ScrollBarsHandler } from '@/app/gridGL/HTMLGrid/scrollBars/ScrollBarsHandler';
import type {
  JsBordersSheet,
  JsHashValidationWarnings,
  JsHtmlOutput,
  JsOffset,
  JsRenderCell,
  JsRenderCodeCell,
  JsRenderFill,
  JsSheetFill,
  JsUpdateCodeCell,
  SheetBounds,
  SheetInfo,
  Validation,
} from '@/app/quadratic-core-types';
import type { SheetContentCache, SheetDataTablesCache } from '@/app/quadratic-core/quadratic_core';
import type { CodeCell } from '@/app/shared/types/codeCell';
import type { RefreshType } from '@/app/shared/types/RefreshType';
import type { SheetPosTS } from '@/app/shared/types/size';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import type { LanguageState } from '@/app/web-workers/languageTypes';
import type { MultiplayerState } from '@/app/web-workers/multiplayerWebWorker/multiplayerClientMessages';
import type { CellEdit, MultiplayerUser } from '@/app/web-workers/multiplayerWebWorker/multiplayerTypes';
import type {
  CoreClientImage,
  CoreClientImportProgress,
  CoreClientTransactionEnd,
  CoreClientTransactionStart,
} from '@/app/web-workers/quadraticCore/coreClientMessages';
import EventEmitter from 'eventemitter3';
import type { Point, Rectangle } from 'pixi.js';

interface EventTypes {
  needRefresh: (state: RefreshType) => void;

  search: (found?: SheetPosTS[], current?: number) => void;
  hoverCell: (cell?: JsRenderCodeCell | EditingCell | ErrorValidation) => void;
  hoverTooltip: (rect?: Rectangle, text?: string, subtext?: string) => void;
  hoverTable: (table?: JsRenderCodeCell) => void;

  zoom: (scale: number) => void;

  undoRedo: (undo: boolean, redo: boolean) => void;

  addSheet: (sheetInfo: SheetInfo, user: boolean) => void;
  deleteSheet: (sheetId: string, user: boolean) => void;
  sheetsInfo: (sheetInfo: SheetInfo[]) => void;
  sheetInfoUpdate: (sheetInfo: SheetInfo) => void;
  changeSheet: (sheetId: string) => void;
  sheetBounds: (sheetBounds: SheetBounds) => void;

  setCursor: (selection?: string) => void;
  cursorPosition: () => void;
  generateThumbnail: () => void;
  changeInput: (input: boolean, initialValue?: string, cursorMode?: CursorMode) => void;
  headingSize: (width: number, height: number) => void;
  gridSettings: () => void;

  sheetOffsets: (sheetId: string, offsets: JsOffset[]) => void;
  sheetFills: (sheetId: string, fills: JsRenderFill[]) => void;
  sheetMetaFills: (sheetId: string, fills: JsSheetFill[]) => void;
  htmlOutput: (html: JsHtmlOutput[]) => void;
  htmlUpdate: (html: JsHtmlOutput) => void;
  bordersSheet: (sheetId: string, borders: JsBordersSheet) => void;
  hashRenderCells: (sheetId: string, renderCells: JsRenderCell[]) => void;
  renderCodeCells: (sheetId: string, renderCodeCells: Uint8Array) => void;

  pythonInit: (version: string) => void;
  pythonState: (state: LanguageState, current?: CodeRun, awaitingExecution?: CodeRun[]) => void;
  javascriptInit: (version: string) => void;
  javascriptState: (state: LanguageState, current?: CodeRun, awaitingExecution?: CodeRun[]) => void;
  connectionState: (state: LanguageState, current?: CodeRun, awaitingExecution?: CodeRun[]) => void;

  updateCodeCells: (updateCodeCells: JsUpdateCodeCell[]) => void;
  updateImage: (message: CoreClientImage) => void;

  importProgress: (message: CoreClientImportProgress) => void;

  transactionStart: (message: CoreClientTransactionStart) => void;
  transactionEnd: (message: CoreClientTransactionEnd) => void;

  multiplayerUpdate: (users: MultiplayerUser[]) => void;
  multiplayerChangeSheet: () => void;
  multiplayerCursor: () => void;
  multiplayerState: (state: MultiplayerState) => void;
  multiplayerCellEdit: (cellEdit: CellEdit, player: MultiplayerUser) => void;
  multiplayerFollow: () => void;
  multiplayerCodeRunning: (multiplayerUser: MultiplayerUser) => void;
  multiplayerSynced: () => void;

  resizeHeadingColumn: (sheetId: string, column: number) => void;
  resizeHeadingRow: (sheetId: string, row: number) => void;

  offlineTransactions: (transactions: number, operations: number) => void;
  offlineTransactionsApplied: (timestamps: number[]) => void;

  connector: (query: string) => void;
  connectorResponse: (buffer: ArrayBuffer) => void;

  codeEditor: () => void;
  cellMoving: (move: boolean) => void;

  insertCodeEditorText: (text: string) => void;

  sheetValidations: (sheetId: string, validations: Validation[]) => void;
  validationWarnings: (warnings: JsHashValidationWarnings[]) => void;

  // pointer down on the grid
  clickedToCell: (column: number, row: number, world: Point | true) => void;

  // dropdown button is pressed for dropdown Validation
  triggerCell: (column: number, row: number, forceOpen: boolean) => void;
  dropdownKeyboard: (key: 'ArrowDown' | 'ArrowUp' | 'Enter' | 'Escape') => void;

  // when validation changes state
  validation: (validation: string | boolean) => void;

  // trigger a context menu
  contextMenu: (options: ContextMenuState) => void;

  suggestionDropdownKeyboard: (key: 'ArrowDown' | 'ArrowUp' | 'Enter' | 'Escape' | 'Tab') => void;

  // use this to set a drawing element to dirty
  viewportChanged: () => void;

  // use this only if you need to immediately get the viewport's value (ie, from React)
  viewportChangedReady: () => void;

  // use this to get the viewport's value after an update is complete
  viewportReadyAfterUpdate: () => void;

  hashContentChanged: (sheetId: string, hashX: number, hashY: number) => void;

  recentFiles: (url: string, name: string, loaded: boolean) => void;
  codeEditorCodeCell: (codeCell?: CodeCell) => void;

  a1Context: (context: Uint8Array) => void;
  a1ContextUpdated: () => void;

  aiAnalystInitialized: () => void;
  pixiAppSettingsInitialized: () => void;
  filesFromIframeInitialized: () => void;

  gridLinesDirty: () => void;

  coreError: (from: string, error: Error | unknown) => void;

  scrollBarsHandler: (scrollBarsHandler: ScrollBarsHandler) => void;
  scrollBar: (state: 'horizontal' | 'vertical' | undefined) => void;

  bitmapFontsLoaded: () => void;

  dataTablesCache: (sheetId: string, dataTablesCache: SheetDataTablesCache) => void;
  contentCache: (sheetId: string, contentCache: SheetContentCache) => void;

  debugFlags: () => void;
}

export const events = new EventEmitter<EventTypes>();
