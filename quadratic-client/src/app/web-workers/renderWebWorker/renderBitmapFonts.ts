// Converts BitmapFont information to a simplified format that can be sent over
// to the render web worker

import { bitmapFonts } from '@/app/gridGL/loadAssets';
import { Assets, type BitmapFont, type CharData } from 'pixi.js';

export interface RenderBitmapChar {
  textureUid: number;
  xAdvance: number;
  xOffset: number;
  yOffset: number;
  origWidth: number;
  textureHeight: number;
  kerning: Record<string, number>;
  uvs: Float32Array;
  frame: { x: number; y: number; width: number; height: number };
}

export interface RenderBitmapFont {
  font: string;
  size: number;
  chars: Record<string, RenderBitmapChar>;
  lineHeight: number;
}

const copyChars = (chars: Record<string, CharData>): Record<string, RenderBitmapChar> => {
  const results: Record<string, RenderBitmapChar> = {};
  for (const char in chars) {
    const charInfo = chars[char];
    if (!charInfo.texture) {
      throw new Error(`Character ${char} has no texture`);
    }
    results[char] = {
      textureUid: charInfo.texture.source.uid,
      uvs: new Float32Array([
        charInfo.texture.uvs.x0,
        charInfo.texture.uvs.y0,
        charInfo.texture.uvs.x1,
        charInfo.texture.uvs.y1,
        charInfo.texture.uvs.x2,
        charInfo.texture.uvs.y2,
        charInfo.texture.uvs.x3,
        charInfo.texture.uvs.y3,
      ]),
      frame: charInfo.texture.frame,
      xAdvance: charInfo.xAdvance,
      xOffset: charInfo.xOffset,
      yOffset: charInfo.yOffset,
      origWidth: charInfo.texture.orig.width,
      textureHeight: charInfo.texture.height,
      kerning: charInfo.kerning,
    };
  }
  return results;
};

// used to shard the BitmapFont information between client and render web worker
export const prepareBitmapFontInformation = (): RenderBitmapFonts => {
  const fonts: RenderBitmapFonts = {};
  for (const font in bitmapFonts) {
    const fontInfo = Assets.get(font) as BitmapFont;
    fonts[font] = {
      font,
      size: fontInfo.fontMetrics.fontSize,
      lineHeight: fontInfo.lineHeight,
      chars: copyChars(fontInfo.chars),
    };
  }

  return fonts;
};

export type RenderBitmapFonts = Record<string, RenderBitmapFont>;
