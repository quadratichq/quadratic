import type { ContextMenuOptions } from '@/app/atoms/contextMenuAtom';
import type { ErrorValidation } from '@/app/gridGL/cells/CellsSheet';
import type { EditingCell } from '@/app/gridGL/HTMLGrid/hoverCell/HoverCell';
import type { CursorMode } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorKeyboard';
import type { CodeCell } from '@/app/gridGL/types/codeCell';
import type {
  JsBordersSheet,
  JsCodeCell,
  JsCodeRun,
  JsHtmlOutput,
  JsOffset,
  JsRenderCell,
  JsRenderCodeCell,
  JsRenderFill,
  JsSheetFill,
  JsSheetPos,
  JsValidationWarning,
  SheetBounds,
  SheetInfo,
  Validation,
} from '@/app/quadratic-core-types';
import type { AIResearcherRequestArgs } from '@/app/ui/menus/AIResearcher/AIResearcherRequestHandler';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import type { LanguageState } from '@/app/web-workers/languageTypes';
import type { MultiplayerState } from '@/app/web-workers/multiplayerWebWorker/multiplayerClientMessages';
import type { CellEdit, MultiplayerUser } from '@/app/web-workers/multiplayerWebWorker/multiplayerTypes';
import type {
  CoreClientImage,
  CoreClientImportProgress,
  CoreClientTransactionProgress,
  CoreClientTransactionStart,
} from '@/app/web-workers/quadraticCore/coreClientMessages';
import EventEmitter from 'eventemitter3';
import type { Point, Rectangle } from 'pixi.js';

interface EventTypes {
  needRefresh: (state: 'required' | 'recommended' | 'force') => void;

  search: (found?: JsSheetPos[], current?: number) => void;
  hoverCell: (cell?: JsRenderCodeCell | EditingCell | ErrorValidation) => void;
  hoverTooltip: (rect?: Rectangle, text?: string, subtext?: string) => void;
  hoverTable: (table?: JsRenderCodeCell) => void;

  zoom: (scale: number) => void;

  undoRedo: (undo: boolean, redo: boolean) => void;

  addSheet: (sheetInfo: SheetInfo, user: boolean) => void;
  deleteSheet: (sheetId: string, user: boolean) => void;
  sheetInfo: (sheetInfo: SheetInfo[]) => void;
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
  bordersSheet: (sheetId: string, borders?: JsBordersSheet) => void;
  renderCells: (sheetId: string, renderCells: JsRenderCell[]) => void;
  renderCodeCells: (sheetId: string, codeCells: JsRenderCodeCell[]) => void;

  pythonInit: (version: string) => void;
  pythonState: (state: LanguageState, current?: CodeRun, awaitingExecution?: CodeRun[]) => void;

  javascriptInit: (version: string) => void;
  javascriptState: (state: LanguageState, current?: CodeRun, awaitingExecution?: CodeRun[]) => void;

  connectionState: (state: LanguageState, current?: CodeRun, awaitingExecution?: CodeRun[]) => void;

  aiResearcherState: (current: JsCodeRun[], awaitingExecution: JsCodeRun[]) => void;

  updateCodeCell: (options: {
    sheetId: string;
    x: number;
    y: number;
    codeCell?: JsCodeCell;
    renderCodeCell?: JsRenderCodeCell;
  }) => void;
  updateImage: (message: CoreClientImage) => void;

  importProgress: (message: CoreClientImportProgress) => void;
  transactionStart: (message: CoreClientTransactionStart) => void;
  transactionProgress: (message: CoreClientTransactionProgress) => void;

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
  renderValidationWarnings: (
    sheetId: string,
    hashX: number | undefined,
    hashY: number | undefined,
    warnings: JsValidationWarning[]
  ) => void;

  // pointer down on the grid
  clickedToCell: (column: number, row: number, world: Point | true) => void;

  // dropdown button is pressed for dropdown Validation
  triggerCell: (column: number, row: number, forceOpen: boolean) => void;
  dropdownKeyboard: (key: 'ArrowDown' | 'ArrowUp' | 'Enter' | 'Escape') => void;

  // when validation changes state
  validation: (validation: string | boolean) => void;

  // trigger a context menu
  contextMenu: (options: ContextMenuOptions) => void;
  contextMenuClose: () => void;

  suggestionDropdownKeyboard: (key: 'ArrowDown' | 'ArrowUp' | 'Enter' | 'Escape' | 'Tab') => void;

  // use this to set a drawing element to dirty
  viewportChanged: () => void;

  // use this only if you need to immediately get the viewport's value (ie, from React)
  viewportChangedReady: () => void;
  hashContentChanged: (sheetId: string, hashX: number, hashY: number) => void;

  recentFiles: (url: string, name: string, loaded: boolean) => void;
  codeEditorCodeCell: (codeCell?: CodeCell) => void;

  a1Context: (context: string) => void;

  aiAnalystInitialized: () => void;
  pixiAppSettingsInitialized: () => void;

  requestAIResearcherResult: (args: AIResearcherRequestArgs) => void;
}

export const events = new EventEmitter<EventTypes>();
