/**
 * Messages between Core web worker and Render web worker.
 */

import { JsRenderCell } from '@/quadratic-core/types';

export interface CoreRequestRenderCells {
  type: 'requestRenderCells';
  id: number;
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CoreRenderCells {
  type: 'renderCells';
  id: number;
  cells: JsRenderCell[];
}

export type SheetRenderMetadata = {
  offsets: string;
  bounds?: { x: number; y: number; width: number; height: number };
};

export type GridRenderMetadata = Record<string, SheetRenderMetadata>;

export interface CoreRenderReady {
  type: 'ready';
  metadata: GridRenderMetadata;
}

export type CoreRenderMessage = CoreRequestRenderCells | CoreRenderCells | CoreRenderReady;
