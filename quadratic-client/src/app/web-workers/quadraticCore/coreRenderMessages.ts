/**
 * Messages between Core web worker and Render web worker.
 */

import type { JsOffset, SheetBounds, SheetInfo, TransactionName } from '@/app/quadratic-core-types';

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
  data: Uint8Array | undefined;
}

export type SheetRenderMetadata = {
  offsets: string;
  bounds?: { x: number; y: number; width: number; height: number };
};

export interface CoreRenderSheetInfo {
  type: 'coreRenderSheetInfo';
  sheetInfo: SheetInfo[];
}

export interface CoreRenderHashRenderCells {
  type: 'coreRenderHashRenderCells';
  hashRenderCells: Uint8Array;
}

export interface CoreRenderHashesDirty {
  type: 'coreRenderHashesDirty';
  dirtyHashes: Uint8Array;
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

export interface CoreRenderViewportBuffer {
  type: 'coreRenderViewportBuffer';
  buffer: SharedArrayBuffer;
}

export interface CoreRenderTransactionStart {
  type: 'coreRenderTransactionStart';
  transactionId: string;
  transactionName: TransactionName;
}

export interface CoreRenderTransactionEnd {
  type: 'coreRenderTransactionEnd';
  transactionId: string;
  transactionName: TransactionName;
}

export type CoreRenderMessage =
  | CoreRenderCells
  | CoreRenderSheetInfo
  | CoreRenderHashRenderCells
  | CoreRenderHashesDirty
  | CoreRenderAddSheet
  | CoreRenderDeleteSheet
  | CoreRenderSheetOffsets
  | CoreRenderSheetInfoUpdate
  | CoreRenderSheetBoundsUpdate
  | CoreRenderRequestRowHeights
  | CoreRenderViewportBuffer
  | CoreRenderTransactionStart
  | CoreRenderTransactionEnd;

export type RenderCoreMessage = RenderCoreRequestRenderCells | RenderCoreResponseRowHeights;
