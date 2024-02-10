export interface CoreLoad {
  type: 'load';
  contents: string;
  lastSequenceNum: number;
  renderMessagePort: MessagePort;
}

export interface CoreReady {
  type: 'ready';
  sheetIds: string[];
}

export interface CoreRequestGridBounds {
  type: 'requestGridBounds';
  id: number;
  sheetId: string;
  ignoreFormatting: boolean;
}

export interface CoreGridBounds {
  type: 'gridBounds';
  id: number;
  bounds: { x: number; y: number; width: number; height: number } | undefined;
}

export type CoreMessage = CoreLoad | CoreReady | CoreRequestGridBounds;
