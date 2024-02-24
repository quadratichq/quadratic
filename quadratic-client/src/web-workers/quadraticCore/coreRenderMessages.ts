/**
 * Messages between Core web worker and Render web worker.
 */

import { JsRenderCell } from '@/quadratic-core/types';

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

export type GridRenderMetadata = Record<string, SheetRenderMetadata>;

export interface CoreRenderReady {
  type: 'coreRenderReady';
  metadata: GridRenderMetadata;
}

export interface CoreRenderCompleteRenderCells {
  type: 'coreRenderCompleteRenderCells';
  sheetId: string;
  hashX: number;
  hashY: number;
  cells: string;
}

export type CoreRenderMessage = CoreRenderCells | CoreRenderReady | CoreRenderCompleteRenderCells;

export type RenderCoreMessage = RenderCoreRequestRenderCells;
