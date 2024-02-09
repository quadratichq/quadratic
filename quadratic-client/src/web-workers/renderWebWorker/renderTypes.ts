import { JsRenderCell } from '@/quadratic-core/types';

export interface RenderMessage {
  type: string;
}

export interface CoreLoad extends RenderMessage {
  type: 'load';
  contents: string;
  lastSequenceNum: number;
}

export interface CoreReady extends RenderMessage {
  type: 'ready';
}

export interface CoreRequestRenderCells extends RenderMessage {
  type: 'requestRenderCells';
  id: number;
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CoreRenderCells extends RenderMessage {
  type: 'renderCells';
  id: number;
  cells: JsRenderCell[];
}
