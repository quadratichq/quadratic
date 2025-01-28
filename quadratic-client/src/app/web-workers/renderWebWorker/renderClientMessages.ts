import type { Link } from '@/app/gridGL/types/links';
import type { DrawRects } from '@/app/gridGL/types/size';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import type { RenderBitmapFonts } from '@/app/web-workers/renderWebWorker/renderBitmapFonts';
import type { RenderSpecial } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellsTextHashSpecial';
import type { Rectangle } from 'pixi.js';

export interface ClientRenderInit {
  type: 'clientRenderInit';
  bitmapFonts: RenderBitmapFonts;

  // this is taken from the CSS variable (which is not accessible in the
  // worker): --table-column-header-foreground
  tableColumnHeaderForeground: number;
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
  overflowGridLines: JsCoordinate[];
  content: Uint32Array;
  links: Link[];
  drawRects: DrawRects[];
}

export interface ClientRenderViewport {
  type: 'clientRenderViewport';
  sheetId: string;
  bounds: Rectangle;
  scale: number;
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
  column: number | null;
  row: number | null;
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
