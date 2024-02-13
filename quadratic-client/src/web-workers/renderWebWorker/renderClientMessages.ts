import { RenderBitmapFonts } from './renderBitmapFonts';

export interface RenderInitMessage {
  type: 'load';
  bitmapFonts: RenderBitmapFonts;
}

// also includes sending the data as transferable ArrayBuffers
export interface RenderLabelMeshEntryMessage {
  type: 'labelMeshEntry';
  sheetId: string;
  hashX: number;
  hashY: number;
  textureUid: number;
  hasColor: boolean;
  vertices: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
  colors?: Float32Array;
}

export interface RenderCellsTextHashClear {
  type: 'cellsTextHashClear';
  sheetId: string;
  hashX: number;
  hashY: number;
  bounds?: { x: number; y: number; width: number; height: number };
}

export type RenderClientMessage = RenderInitMessage | RenderLabelMeshEntryMessage | RenderCellsTextHashClear;
