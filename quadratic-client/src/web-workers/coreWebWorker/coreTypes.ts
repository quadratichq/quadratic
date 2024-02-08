import { JsRenderCell } from '@/quadratic-core/types';

export interface CoreMessage {
  type: string;
}

export interface CoreLoad extends CoreMessage {
  type: 'load';
  contents: string;
  lastSequenceNum: number;
}

export interface CoreReady extends CoreMessage {
  type: 'ready';
}

export interface CoreRequestRenderCells extends CoreMessage {
  type: 'requestRenderCells';
  id: number;
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CoreRenderCells extends CoreMessage {
  type: 'renderCells';
  id: number;
  cells: JsRenderCell[];
}
