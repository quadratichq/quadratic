import type { ImportFile } from '@/app/ai/hooks/useImportFilesToGrid';
import type { ContextMenuState } from '@/app/atoms/contextMenuAtom';
import type { ErrorValidation } from '@/app/gridGL/cells/CellsSheet';
import type { TimerNames } from '@/app/gridGL/helpers/startupTimer';
import type { EditingCell } from '@/app/gridGL/HTMLGrid/hoverCell/HoverCell';
import type { CursorMode } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorKeyboard';
import type {
  ConditionalFormatClient,
  JsBordersSheet,
  JsHashValidationWarnings,
  JsHtmlOutput,
  JsOffset,
  JsRenderCell,
  JsRenderCodeCell,
  JsSheetFill,
  JsUpdateCodeCell,
  SheetBounds,
  SheetInfo,
  Validation,
} from '@/app/quadratic-core-types';
import type { JsMergeCells, SheetContentCache, SheetDataTablesCache } from '@/app/quadratic-core/quadratic_core';
import type { CodeCell } from '@/app/shared/types/codeCell';
import type { RefreshType } from '@/app/shared/types/RefreshType';
import type { SheetPosTS } from '@/app/shared/types/size';
import type { CodeRun } from '@/app/web-workers/CodeRun';
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
import type { Content, Context } from 'quadratic-shared/typesAndSchemasAI';

export interface DirtyObject {
  gridLines?: boolean;
  headings?: boolean;
  cursor?: boolean;
  cellHighlights?: boolean;
  multiplayerCursor?: boolean;
  boxCells?: boolean;
  cellMoving?: boolean;
  cellImages?: boolean;
  viewport?: boolean;
}

interface EventTypes {
  needRefresh: (state: RefreshType) => void;

  search: (found?: SheetPosTS[], current?: number) => void;
  hoverCell: (cell?: JsRenderCodeCell | EditingCell | ErrorValidation) => void;
  hoverTooltip: (rect?: Rectangle, text?: string, subtext?: string) => void;
  hoverLink: (link?: {
    x: number;
    y: number;
    url: string;
    rect: Rectangle;
    linkText?: string;
    isNakedUrl?: boolean;
    spanStart?: number;
    spanEnd?: number;
  }) => void;
  insertLink: () => void;
  insertLinkInline: (data: {
    selectedText: string;
    selectionRange?: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number };
  }) => void;
  showInlineHyperlinkInput: (data: { selectedText: string; existingUrl?: string }) => void;
  inlineEditorCursorOnHyperlink: (data?: { url: string; rect: Rectangle; linkText: string }) => void;
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
  sheetOffsetsUpdated: (sheetId: string) => void;
  hashRenderFills: (hashRenderFills: Uint8Array) => void;
  hashesDirtyFills: (dirtyHashes: Uint8Array) => void;
  sheetMetaFills: (sheetId: string, fills: JsSheetFill[]) => void;
  htmlOutput: (html: JsHtmlOutput[]) => void;
  htmlUpdate: (html: JsHtmlOutput) => void;
  bordersSheet: (sheetId: string, borders: JsBordersSheet) => void;
  hashRenderCells: (sheetId: string, renderCells: JsRenderCell[]) => void;
  renderCodeCells: (sheetId: string, renderCodeCells: Uint8Array) => void;

  pythonInit: (version: string) => void;
  javascriptInit: (version: string) => void;
  codeRunningState: (current?: CodeRun, awaitingExecution?: CodeRun[]) => void;

  updateCodeCells: (updateCodeCells: JsUpdateCodeCell[]) => void;
  updateImage: (message: CoreClientImage) => void;

  importProgress: (message: CoreClientImportProgress) => void;

  transactionStart: (message: CoreClientTransactionStart) => void;
  transactionEnd: (message: CoreClientTransactionEnd) => void;
  transactionEndUpdated: (transactionId: string) => void;

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
  sheetConditionalFormats: (sheetId: string, conditionalFormats: ConditionalFormatClient[]) => void;
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
  emojiDropdownKeyboard: (key: 'ArrowDown' | 'ArrowUp' | 'Enter' | 'Escape' | 'Tab') => void;

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

  coreError: (from: string, error: Error | unknown) => void;

  bitmapFontsLoaded: () => void;

  dataTablesCache: (sheetId: string, dataTablesCache: SheetDataTablesCache) => void;
  contentCache: (sheetId: string, contentCache: SheetContentCache) => void;

  debugFlags: () => void;

  startupTimer: (name: TimerNames, data: { start?: number; end?: number }) => void;

  setDirty: (dirty: DirtyObject) => void;

  aiAnalystDroppedFiles: (files: FileList | File[]) => void;
  aiAnalystAddReference: (reference: string) => void;
  aiAnalystReady: () => void;
  aiAnalystSubmitPrompt: (args: {
    content: Content;
    messageSource: string;
    context: Context;
    messageIndex: number;
    importFiles: ImportFile[];
  }) => void;
  aiAnalystSelectConnection: (connectionUuid: string, connectionType: string, connectionName: string) => void;

  mergeCells: (sheetId: string, mergeCells: JsMergeCells) => void;

  // Formatting button keyboard triggers (for visual feedback)
  formatButtonKeyboard: (action: string) => void;

  // Format painter events
  formatPainterStart: (sourceSelection: string, sourceSheetId: string) => void;
  formatPainterEnd: () => void;
}

export const events = new EventEmitter<EventTypes>();
