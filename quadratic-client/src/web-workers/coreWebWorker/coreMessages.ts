/**
 * Shared Core messages that talk to both Core web worker and Render web worker.
 */

export interface CoreRequestGridBounds {
  type: 'requestGridBounds';
  id: number;
  sheetId: string;
  ignoreFormatting: boolean;
}

export interface CoreGridBounds {
  type: 'gridBounds';
  id: number;
  bounds: { x: number; y: number; width: number; height: number };
}
