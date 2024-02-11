/**
 * Shared Core messages that talk to both coreClient and coreRender.
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
