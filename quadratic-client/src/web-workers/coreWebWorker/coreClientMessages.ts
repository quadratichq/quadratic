/**
 * Messages between Core web worker and main thread (Client).
 */

import { CoreGridBounds, CoreReady, CoreRequestGridBounds } from './coreMessages';

export interface CoreClientLoad {
  type: 'load';
  contents: string;
  lastSequenceNum: number;
}

export type CoreClientMessage = CoreClientLoad | CoreRequestGridBounds | CoreGridBounds | CoreReady;
