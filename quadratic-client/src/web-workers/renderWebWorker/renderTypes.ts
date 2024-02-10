import { JsRenderCell } from '@/quadratic-core/types';

export interface RenderRequestRenderCells {
  type: 'requestRenderCells';
  id: number;
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderCells {
  type: 'renderCells';
  id: number;
  cells: JsRenderCell[];
}

export type RenderMessage = RenderRequestRenderCells | RenderCells;
