import { RenderBitmapFonts } from './renderBitmapFonts';

export interface RenderInitMessage {
  type: 'load';
  bitmapFonts: RenderBitmapFonts;
}

export type RenderClientMessage = RenderInitMessage;
