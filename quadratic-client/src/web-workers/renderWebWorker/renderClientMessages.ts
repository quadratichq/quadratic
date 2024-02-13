import { RenderBitmapFonts } from './renderBitmapFonts';

export interface RenderInitMessage {
  type: 'load';
  bitmapFonts: RenderBitmapFonts;
}

// also includes sending the data as transferable ArrayBuffers
export interface RenderLabelMeshEntryMessage {
  type: 'labelMeshEntry';
  textureUid: number;
  hasColor: boolean;
  vertices: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
  colors?: Float32Array;
}

export type RenderClientMessage = RenderInitMessage | RenderLabelMeshEntryMessage;
