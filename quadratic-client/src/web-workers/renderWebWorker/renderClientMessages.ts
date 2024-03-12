import { Rectangle } from 'pixi.js';
import { RenderBitmapFonts } from './renderBitmapFonts';

export interface ClientRenderInit {
  type: 'clientRenderInit';
  bitmapFonts: RenderBitmapFonts;
}

// also includes sending the data as transferable ArrayBuffers
export interface RenderClientLabelMeshEntry {
  type: 'renderClientLabelMeshEntry';
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
  type: 'renderClientCellsTextHashClear';
  sheetId: string;
  hashX: number;
  hashY: number;
  viewRectangle: { x: number; y: number; width: number; height: number };
}

export interface ClientRenderViewport {
  type: 'clientRenderViewport';
  sheetId: string;
  bounds: Rectangle;
}

export interface RenderClientFirstRenderComplete {
  type: 'renderClientFirstRenderComplete';
}

export interface RenderClientUnload {
  type: 'renderClientUnload';
  sheetId: string;
  hashX: number;
  hashY: number;
}

export interface ClientRenderSheetOffsetsTransient {
  type: 'clientRenderSheetOffsetsTransient';
  sheetId: string;
  column?: number;
  row?: number;
  delta: number;
}

export interface RenderClientFinalizeCellsTextHash {
  type: 'renderClientFinalizeCellsTextHash';
  sheetId: string;
  hashX: number;
  hashY: number;
}

export type RenderClientMessage =
  | RenderClientLabelMeshEntry
  | RenderClientCellsTextHashClear
  | RenderClientFirstRenderComplete
  | RenderClientUnload
  | RenderClientFinalizeCellsTextHash;

export type ClientRenderMessage = ClientRenderInit | ClientRenderViewport | ClientRenderSheetOffsetsTransient;
