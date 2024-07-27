/**
 * Messages between Core web worker and Render web worker.
 */

import type { JsRenderCell, SheetBounds, SheetInfo } from '@/app/quadratic-core-types';

export interface RenderCoreRequestRenderCells {
  type: 'renderCoreRequestRenderCells';
  id: number;
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
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
  cells: string;
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
  column?: number;
  row?: number;
  size: number;
}

export interface CoreRenderSheetInfoUpdate {
  type: 'coreRenderSheetInfoUpdate';
  sheetInfo: SheetInfo;
}

export interface CoreRenderSheetBoundsUpdate {
  type: 'coreRenderSheetBoundsUpdate';
  sheetBounds: SheetBounds;
}

export type CoreRenderMessage =
  | CoreRenderCells
  | CoreRenderSheetInfo
  | CoreRenderCompleteRenderCells
  | CoreRenderAddSheet
  | CoreRenderDeleteSheet
  | CoreRenderSheetOffsets
  | CoreRenderSheetInfoUpdate
  | CoreRenderSheetBoundsUpdate;

export type RenderCoreMessage = RenderCoreRequestRenderCells;
