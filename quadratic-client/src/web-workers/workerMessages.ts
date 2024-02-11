export interface ResponseLoad {
  type: 'ready';
  sheetIds: string[];
}

// todo: this should pass a Sheet's entire GridBounds instead of making requests because of performance
export interface RequestGridBounds {
  type: 'requestGridBounds';
  id: number;
  sheetId: string;
  ignoreFormatting: boolean;
}

export interface ResponseGridBounds {
  type: 'gridBounds';
  id: number;
  bounds: { x: number; y: number; width: number; height: number } | undefined;
}

export type WorkerMessage =
  | RequestRenderCells
  | ResponseRenderCells
  | RequestLoad
  | ResponseLoad
  | RequestGridBounds
  | ResponseGridBounds;
