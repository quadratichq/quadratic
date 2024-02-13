/**
 * Messages between Core web worker and main thread (Client).
 */

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

export type CoreClientMessage = CoreClientLoad | CoreRequestGridBounds | CoreGridBounds | CoreClientReady;
