/**
 * Messages between Core web worker and main thread (Client).
 */

import { CoreGridBounds, CoreRequestGridBounds } from './coreMessages';

export interface CoreClientLoad {
  type: 'load';
  contents: string;
  lastSequenceNum: number;
}

export interface CoreClientReady {
  type: 'ready';
  sheetIds: string[];
}

export type CoreClientMessage = CoreClientLoad | CoreClientReady | CoreRequestGridBounds | CoreGridBounds;
