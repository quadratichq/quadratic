/**
 * Messages between Core web worker and Render web worker.
 */

import { JsRenderCell } from '@/quadratic-core/types';
import { CoreGridBounds, CoreRequestGridBounds } from './coreMessages';

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

export type CoreRenderMessage = CoreRequestRenderCells | CoreRenderCells | CoreRequestGridBounds | CoreGridBounds;
