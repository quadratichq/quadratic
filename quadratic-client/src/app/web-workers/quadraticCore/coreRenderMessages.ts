/**
 * Messages between Core web worker and Render web worker.
 */

import type { TransactionName } from '@/app/quadratic-core-types';

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

export interface CoreRenderSheetsInfo {
  type: 'coreRenderSheetsInfo';
  sheetsInfo: Uint8Array;
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
  sheetInfo: Uint8Array;
}

export interface CoreRenderDeleteSheet {
  type: 'coreRenderDeleteSheet';
  sheetId: string;
}

export interface CoreRenderSheetOffsets {
  type: 'coreRenderSheetOffsets';
  sheetId: string;
  offsets: Uint8Array;
}

export interface CoreRenderSheetInfoUpdate {
  type: 'coreRenderSheetInfoUpdate';
  sheetInfo: Uint8Array;
}

export interface CoreRenderSheetBoundsUpdate {
  type: 'coreRenderSheetBoundsUpdate';
  sheetBounds: Uint8Array;
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

export interface CoreRenderMergeCells {
  type: 'coreRenderMergeCells';
  sheetId: string;
  mergeCells: Uint8Array;
  dirtyHashes: Uint8Array;
}

export type CoreRenderMessage =
  | CoreRenderCells
  | CoreRenderSheetsInfo
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
  | CoreRenderTransactionEnd
  | CoreRenderMergeCells;

export type RenderCoreMessage = RenderCoreRequestRenderCells | RenderCoreResponseRowHeights;
