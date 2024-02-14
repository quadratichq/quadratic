/**
 * Messages between Core web worker and main thread (Client).
 */

import { JsCodeCell } from '@/quadratic-core/types';
import { CoreGridBounds, CoreRequestGridBounds } from './coreMessages';

export interface CoreClientLoad {
  type: 'load';
  url: string;
  version: string;
  sequenceNumber: number;
  thumbnail: boolean;
}

export interface SheetMetadata {
  offsets: string;
  bounds?: { x: number; y: number; width: number; height: number };
  boundsNoFormatting?: { x: number; y: number; width: number; height: number };
  name: string;
  order: string;
  color?: string;
}

export interface GridMetadata {
  undo: boolean;
  redo: boolean;
  sheets: Record<string, SheetMetadata>;
}

export interface CoreClientReady {
  type: 'ready';
  metadata: GridMetadata;
}

export interface CoreClientGetCodeCell {
  type: 'getCodeCell';
  id: number;
  sheetId: string;
  x: number;
  y: number;
}

export interface CoreClientGetCodeCellResponse {
  type: 'getCodeCellResponse';
  id: number;
  cell: JsCodeCell | undefined;
}

export type CoreClientMessage =
  | CoreClientLoad
  | CoreRequestGridBounds
  | CoreGridBounds
  | CoreClientReady
  | CoreClientGetCodeCell
  | CoreClientGetCodeCellResponse;
