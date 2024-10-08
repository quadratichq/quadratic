/**
 * Messages between Core web worker and Render web worker.
 */

import { JsOffset, JsRenderCell, SheetBounds, SheetInfo } from '@/app/quadratic-core-types';

export interface RenderCoreRequestRenderCells {
  type: 'renderCoreRequestRenderCells';
  id: number;
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderCoreResponseRowHeights {
  type: 'renderCoreResponseRowHeights';
  transactionId: string;
  sheetId: string;
  rowHeights: string;
}

export interface CoreRenderCells {
  type: 'coreRenderRenderCells';
  id: number;
  cells: JsRenderCell[];
}

export type SheetRenderMetadata = {
  offsets: string;
  bounds?: { x: number; y: number; width: number; height: number };
};

export interface CoreRenderSheetInfo {
  type: 'coreRenderSheetInfo';
  sheetInfo: SheetInfo[];
}

export interface CoreRenderCompleteRenderCells {
  type: 'coreRenderCompleteRenderCells';
  sheetId: string;
  hashX: number;
  hashY: number;
  renderCells: JsRenderCell[];
}

export interface CoreRenderAddSheet {
  type: 'coreRenderAddSheet';
  sheetInfo: SheetInfo;
}

export interface CoreRenderDeleteSheet {
  type: 'coreRenderDeleteSheet';
  sheetId: string;
}

export interface CoreRenderSheetOffsets {
  type: 'coreRenderSheetOffsets';
  sheetId: string;
  offsets: JsOffset[];
}

export interface CoreRenderSheetInfoUpdate {
  type: 'coreRenderSheetInfoUpdate';
  sheetInfo: SheetInfo;
}

export interface CoreRenderSheetBoundsUpdate {
  type: 'coreRenderSheetBoundsUpdate';
  sheetBounds: SheetBounds;
}

export interface CoreRenderRequestRowHeights {
  type: 'coreRenderRequestRowHeights';
  transactionId: string;
  sheetId: string;
  rows: string;
}

export interface CoreRenderHashesDirty {
  type: 'coreRenderHashesDirty';
  sheetId: string;
  hashes: string;
}

export interface CoreRenderViewportBuffer {
  type: 'coreRenderViewportBuffer';
  buffer: SharedArrayBuffer;
}

export type CoreRenderMessage =
  | CoreRenderCells
  | CoreRenderSheetInfo
  | CoreRenderCompleteRenderCells
  | CoreRenderAddSheet
  | CoreRenderDeleteSheet
  | CoreRenderSheetOffsets
  | CoreRenderSheetInfoUpdate
  | CoreRenderSheetBoundsUpdate
  | CoreRenderRequestRowHeights
  | CoreRenderHashesDirty
  | CoreRenderViewportBuffer;

export type RenderCoreMessage = RenderCoreRequestRenderCells | RenderCoreResponseRowHeights;
