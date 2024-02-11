import { JsRenderCell } from '@/quadratic-core/types';

export interface CoreRenderLoad {
  type: 'load';
  sheetIds: string[];
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

export type CoreRenderMessage = CoreRenderLoad | CoreRequestRenderCells | CoreRenderCells | CoreRequestGridBounds;
