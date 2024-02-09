import { JsRenderCell } from '@/quadratic-core/types';

export interface CoreLoad {
  type: 'load';
  contents: string;
  lastSequenceNum: number;
}

export interface CoreReady {
  type: 'ready';
}

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

export interface CoreRequestGridBounds {
  type: 'requestGridBounds';
  id: number;
  sheetId: string;
  ignoreFormatting: boolean;
}

export interface CoreGridBounds {
  type: 'gridBounds';
  id: number;
  bounds: { x: number; y: number; width: number; height: number } | undefined;
}

export type CoreMessage = CoreLoad | CoreReady | CoreRequestRenderCells | CoreRenderCells | CoreRequestGridBounds;
