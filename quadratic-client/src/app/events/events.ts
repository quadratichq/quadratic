import { EditingCell } from '@/app/gridGL/HTMLGrid/hoverCell/HoverCell';
import { PanMode } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { SheetPosTS } from '@/app/gridGL/types/size';
import {
  JsCodeCell,
  JsHtmlOutput,
  JsRenderBorders,
  JsRenderCodeCell,
  JsRenderFill,
  JsSheetFill,
  Selection,
  SheetBounds,
  SheetInfo,
} from '@/app/quadratic-core-types';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import { LanguageState } from '@/app/web-workers/languageTypes';
import { MultiplayerState } from '@/app/web-workers/multiplayerWebWorker/multiplayerClientMessages';
import { CellEdit, MultiplayerUser } from '@/app/web-workers/multiplayerWebWorker/multiplayerTypes';
import {
  CoreClientImage,
  CoreClientImportProgress,
  CoreClientTransactionProgress,
  CoreClientTransactionStart,
} from '@/app/web-workers/quadraticCore/coreClientMessages';
import EventEmitter from 'eventemitter3';

interface EventTypes {
  needRefresh: (state: 'required' | 'recommended' | 'force') => void;

  search: (found?: SheetPosTS[], current?: number) => void;
  hoverCell: (cell?: JsRenderCodeCell | EditingCell) => void;

  zoom: (scale: number) => void;
  panMode: (pan: PanMode) => void;

  undoRedo: (undo: boolean, redo: boolean) => void;

  addSheet: (sheetInfo: SheetInfo, user: boolean) => void;
  deleteSheet: (sheetId: string, user: boolean) => void;
  sheetInfo: (sheetInfo: SheetInfo[]) => void;
  sheetInfoUpdate: (sheetInfo: SheetInfo) => void;
  changeSheet: () => void;
  sheetBounds: (sheetBounds: SheetBounds) => void;

  setCursor: (cursor?: string, selection?: Selection) => void;
  cursorPosition: () => void;
  generateThumbnail: () => void;
  changeInput: (input: boolean, initialValue?: string) => void;
  headingSize: (width: number, height: number) => void;
  gridSettings: () => void;

  sheetOffsets: (sheetId: string, column: number | undefined, row: number | undefined, size: number) => void;
  sheetFills: (sheetId: string, fills: JsRenderFill[]) => void;
  sheetMetaFills: (sheetId: string, fills: JsSheetFill) => void;
  htmlOutput: (html: JsHtmlOutput[]) => void;
  htmlUpdate: (html: JsHtmlOutput) => void;
  sheetBorders: (sheetId: string, borders: JsRenderBorders) => void;
  renderCodeCells: (sheetId: string, codeCells: JsRenderCodeCell[]) => void;

  pythonInit: (version: string) => void;
  pythonState: (state: LanguageState, current?: CodeRun, awaitingExecution?: CodeRun[]) => void;
  javascriptInit: (version: string) => void;
  javascriptState: (state: LanguageState, current?: CodeRun, awaitingExecution?: CodeRun[]) => void;
  connectionState: (state: LanguageState, current?: CodeRun, awaitingExecution?: CodeRun[]) => void;

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

  resizeHeadingColumn: (sheetId: string, column: number) => void;

  offlineTransactions: (transactions: number, operations: number) => void;

  connector: (query: string) => void;
  connectorResponse: (buffer: ArrayBuffer) => void;

  codeEditor: () => void;
  cellMoving: (move: boolean) => void;

  insertCodeEditorText: (text: string) => void;
}

export const events = new EventEmitter<EventTypes>();
