import {
  JsHtmlOutput,
  JsRenderBorders,
  JsRenderCodeCell,
  JsRenderFill,
  SheetBounds,
  SheetInfo,
} from '@/quadratic-core-types';
import { CoreClientImportProgress } from '@/web-workers/quadraticCore/coreClientMessages';
import EventEmitter from 'eventemitter3';

interface EventTypes {
  undoRedo: (undo: boolean, redo: boolean) => void;

  addSheet: (sheetInfo: SheetInfo, user: boolean) => void;
  deleteSheet: (sheetId: string, user: boolean) => void;
  sheetInfo: (sheetInfo: SheetInfo[]) => void;
  sheetInfoUpdate: (sheetInfo: SheetInfo) => void;
  changeSheet: () => void;
  sheetBounds: (sheetBounds: SheetBounds) => void;

  setCursor: (cursor: string) => void;
  generateThumbnail: () => void;

  sheetOffsets: (sheetId: string, column: number | undefined, row: number | undefined, size: number) => void;
  sheetFills: (sheetId: string, fills: JsRenderFill[]) => void;
  htmlOutput: (html: JsHtmlOutput[]) => void;
  htmlUpdate: (html: JsHtmlOutput) => void;
  sheetBorders: (sheetId: string, borders: JsRenderBorders) => void;
  renderCodeCells: (sheetId: string, codeCells: JsRenderCodeCell[]) => void;

  pythonLoaded: (version: string) => void;
  pythonError: (error?: string) => void;

  importProgress: (message: CoreClientImportProgress) => void;
}

export const events = new EventEmitter<EventTypes>();
