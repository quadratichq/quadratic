// Converts BitmapFont information to a simplified format that can be sent over
// to the render web worker

import type { IBitmapFontCharacter } from 'pixi.js';
import { BitmapFont } from 'pixi.js';

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
  specialEmoji?: string;
}

export interface RenderBitmapFont {
  font: string;
  size: number;
  chars: Record<string, RenderBitmapChar>;
  lineHeight: number;
}

const copyChars = (chars: Record<string, IBitmapFontCharacter>): Record<string, RenderBitmapChar> => {
  const results: Record<string, RenderBitmapChar> = {};
  for (const char in chars) {
    const charInfo = chars[char];
    results[char] = {
      textureUid: charInfo.texture.baseTexture.uid,
      uvs: charInfo.texture._uvs.uvsFloat32,
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
  for (const font in BitmapFont.available) {
    const fontInfo = BitmapFont.available[font];
    fonts[font] = {
      font,
      size: fontInfo.size,
      lineHeight: fontInfo.lineHeight,
      chars: copyChars(fontInfo.chars),
    };
  }

  return fonts;
};

export type RenderBitmapFonts = Record<string, RenderBitmapFont>;
