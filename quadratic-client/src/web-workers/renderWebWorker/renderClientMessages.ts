import { Rectangle } from 'pixi.js';
import { RenderBitmapFonts } from './renderBitmapFonts';

export interface ClientRenderInit {
  type: 'clientRenderInit';
  bitmapFonts: RenderBitmapFonts;
}

// also includes sending the data as transferable ArrayBuffers
export interface RenderClientLabelMeshEntry {
  type: 'labelMeshEntry';
  sheetId: string;
  hashX: number;
  hashY: number;
  fontName: string;
  fontSize: number;
  textureUid: number;
  hasColor: boolean;
  vertices: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
  colors?: Float32Array;
}

export interface RenderClientCellsTextHashClear {
  type: 'cellsTextHashClear';
  sheetId: string;
  hashX: number;
  hashY: number;
  bounds?: { x: number; y: number; width: number; height: number };
}

export interface ClientRenderViewport {
  type: 'clientRenderViewport';
  sheetId: string;
  bounds: Rectangle;
}

export type RenderClientMessage = RenderClientLabelMeshEntry | RenderClientCellsTextHashClear;
export type ClientRenderMessage = ClientRenderInit | ClientRenderViewport;
