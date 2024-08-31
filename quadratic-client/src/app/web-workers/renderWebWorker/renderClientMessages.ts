import { Coordinate, DrawRects } from '@/app/gridGL/types/size';
import { Rectangle } from 'pixi.js';
import { RenderBitmapFonts } from './renderBitmapFonts';
import type { RenderSpecial } from './worker/cellsLabel/CellsTextHashSpecial';

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
  overflowGridLines: Coordinate[];
  content: Uint32Array;
  links: Coordinate[];
  drawRects: DrawRects[];
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
  special?: RenderSpecial;
}

export interface ClientRenderShowLabel {
  type: 'clientRenderShowLabel';
  sheetId: string;
  x: number;
  y: number;
  show: boolean;
}

export interface ClientRenderColumnMaxWidth {
  type: 'clientRenderColumnMaxWidth';
  id: number;
  sheetId: string;
  column: number;
}

export interface ClientRenderRowMaxHeight {
  type: 'clientRenderRowMaxHeight';
  id: number;
  sheetId: string;
  row: number;
}

export interface RenderClientColumnMaxWidth {
  type: 'renderClientColumnMaxWidth';
  id: number;
  maxWidth: number;
}

export interface RenderClientRowMaxHeight {
  type: 'renderClientRowMaxHeight';
  id: number;
  maxHeight: number;
}

export type RenderClientMessage =
  | RenderClientLabelMeshEntry
  | RenderClientCellsTextHashClear
  | RenderClientFirstRenderComplete
  | RenderClientUnload
  | RenderClientFinalizeCellsTextHash
  | RenderClientColumnMaxWidth
  | RenderClientRowMaxHeight;

export type ClientRenderMessage =
  | ClientRenderInit
  | ClientRenderViewport
  | ClientRenderSheetOffsetsTransient
  | ClientRenderShowLabel
  | ClientRenderColumnMaxWidth
  | ClientRenderRowMaxHeight;
