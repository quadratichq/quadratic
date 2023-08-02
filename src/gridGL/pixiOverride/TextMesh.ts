/* eslint-disable @typescript-eslint/no-unused-vars */
import { removeItems } from '@pixi/utils';
import { BitmapFont, Container, Mesh, Point, Texture } from 'pixi.js';
import { extractCharCode, splitTextToCharacters } from './bitmapTextUtils';

export interface PageMeshData {
  index: number;
  indexCount: number;
  vertexCount: number;
  uvsCount: number;
  total: number;
  mesh: Mesh;
  vertices?: Float32Array;
  uvs?: Float32Array;
  indices?: Uint16Array;
}
export interface CharRenderData {
  texture: Texture;
  line: number;
  charCode: number;
  position: Point;
  prevSpaces: number;
}

// this is not a real Container class; only the data is interesting for ContainerBitmapText (ie, nothing is rendered)
export class TextMesh extends Container {
  text: string;
  fontName: string;
  fontSize: number;
  tint?: number;
  maxWidth: number;
  roundPixels?: boolean;

  clipLeft: number | undefined;
  clipRight: number | undefined;

  // used by ContainerBitmapText rendering
  chars: CharRenderData[] = [];
  lineAlignOffsets: number[] = [];
  align?: 'left' | 'right' | 'justify' | 'center';
  letterSpacing: number;

  textWidth = 0;
  textHeight = 0;

  dirty = true;

  constructor(
    text: string,
    options: {
      fontName: string;
      fontSize: number;
      tint?: number;
      align?: 'left' | 'right' | 'justify' | 'center';
      maxWidth?: number;
      roundPixels?: boolean;
      letterSpacing?: number;
    }
  ) {
    super();
    this.text = text;
    this.fontName = options.fontName;
    this.fontSize = options.fontSize;
    this.roundPixels = options.roundPixels;
    this.maxWidth = options.maxWidth ?? 0;
    this.align = options.align;
    this.letterSpacing = options.letterSpacing ?? 0;
    this.tint = options.tint;
  }

  updatePageMesh(pagesMeshData: Record<string, PageMeshData>): void {
    const data = BitmapFont.available[this.fontName];
    const scale = this.fontSize / data.size;
    for (let i = 0; i < this.chars.length; i++) {
      const char = this.chars[i];
      let offset =
        char.position.x + this.lineAlignOffsets[char.line] * (this.align === 'justify' ? char.prevSpaces : 1);
      if (this.roundPixels) {
        offset = Math.round(offset);
      }
      const xPos = this.position.x + offset * scale;
      const yPos = this.position.y + char.position.y * scale;
      const texture = char.texture;
      const pageMesh = pagesMeshData[texture.baseTexture.uid];
      const textureFrame = texture.frame;
      const textureUvs = texture._uvs;
      // remove letters that are outside the clipping bounds
      if (
        (this.clipRight !== undefined && xPos + textureFrame.width * scale + this.x >= this.clipRight) ||
        (this.clipLeft !== undefined && xPos + this.x <= this.clipLeft)
      ) {
        // this removes extra characters from the mesh after a clip
        pageMesh.mesh.size -= 6;
      } else {
        const index = pageMesh.index++;
        pageMesh.indices![index * 6 + 0] = 0 + index * 4;
        pageMesh.indices![index * 6 + 1] = 1 + index * 4;
        pageMesh.indices![index * 6 + 2] = 2 + index * 4;
        pageMesh.indices![index * 6 + 3] = 0 + index * 4;
        pageMesh.indices![index * 6 + 4] = 2 + index * 4;
        pageMesh.indices![index * 6 + 5] = 3 + index * 4;
        pageMesh.vertices![index * 8 + 0] = xPos;
        pageMesh.vertices![index * 8 + 1] = yPos;
        pageMesh.vertices![index * 8 + 2] = xPos + textureFrame.width * scale;
        pageMesh.vertices![index * 8 + 3] = yPos;
        pageMesh.vertices![index * 8 + 4] = xPos + textureFrame.width * scale;
        pageMesh.vertices![index * 8 + 5] = yPos + textureFrame.height * scale;
        pageMesh.vertices![index * 8 + 6] = xPos;
        pageMesh.vertices![index * 8 + 7] = yPos + textureFrame.height * scale;
        pageMesh.uvs![index * 8 + 0] = textureUvs.x0;
        pageMesh.uvs![index * 8 + 1] = textureUvs.y0;
        pageMesh.uvs![index * 8 + 2] = textureUvs.x1;
        pageMesh.uvs![index * 8 + 3] = textureUvs.y1;
        pageMesh.uvs![index * 8 + 4] = textureUvs.x2;
        pageMesh.uvs![index * 8 + 5] = textureUvs.y2;
        pageMesh.uvs![index * 8 + 6] = textureUvs.x3;
        pageMesh.uvs![index * 8 + 7] = textureUvs.y3;
      }
    }
    for (const i in pagesMeshData) {
      const pageMeshData = pagesMeshData[i];
      const vertexBuffer = pageMeshData.mesh.geometry.getBuffer('aVertexPosition');
      const textureBuffer = pageMeshData.mesh.geometry.getBuffer('aTextureCoord');
      const indexBuffer = pageMeshData.mesh.geometry.getIndex();
      vertexBuffer.data = pageMeshData.vertices!;
      textureBuffer.data = pageMeshData.uvs!;
      indexBuffer.data = pageMeshData.indices!;
      vertexBuffer.update();
      textureBuffer.update();
      indexBuffer.update();
    }
  }

  /** updates text as part of ContainerBitmapText */
  public updateText(): void {
    if (!this.dirty) return;
    this.dirty = false;

    const data = BitmapFont.available[this.fontName];
    const pos = new Point();
    this.chars = [];
    const lineWidths = [];
    const lineSpaces = [];
    const text = this.text.replace(/(?:\r\n|\r)/g, '\n') || ' ';
    const charsInput = splitTextToCharacters(text);
    const maxWidth = (this.maxWidth * data.size) / this.fontSize;
    let prevCharCode = null;
    let lastLineWidth = 0;
    let maxLineWidth = 0;
    let line = 0;
    let lastBreakPos = -1;
    let lastBreakWidth = 0;
    let spacesRemoved = 0;
    let maxLineHeight = 0;
    let spaceCount = 0;
    let i: number;
    for (i = 0; i < charsInput.length; i++) {
      const char = charsInput[i];
      const charCode = extractCharCode(char);
      if (/(?:\s)/.test(char)) {
        lastBreakPos = i;
        lastBreakWidth = lastLineWidth;
        spaceCount++;
      }
      if (char === '\r' || char === '\n') {
        lineWidths.push(lastLineWidth);
        lineSpaces.push(-1);
        maxLineWidth = Math.max(maxLineWidth, lastLineWidth);
        ++line;
        ++spacesRemoved;
        pos.x = 0;
        pos.y += data.lineHeight;
        prevCharCode = null;
        spaceCount = 0;
        continue;
      }
      const charData = data.chars[charCode];
      if (!charData) {
        continue;
      }
      if (prevCharCode && charData.kerning[prevCharCode]) {
        pos.x += charData.kerning[prevCharCode];
      }
      const charRenderData: CharRenderData = {
        texture: Texture.EMPTY,
        line: 0,
        charCode: 0,
        prevSpaces: 0,
        position: new Point(),
      };
      charRenderData.texture = charData.texture;
      charRenderData.line = line;
      charRenderData.charCode = charCode;
      charRenderData.position.x = pos.x + charData.xOffset + this.letterSpacing / 2;
      charRenderData.position.y = pos.y + charData.yOffset;
      charRenderData.prevSpaces = spaceCount;
      this.chars.push(charRenderData);
      lastLineWidth = charRenderData.position.x + Math.max(charData.xAdvance, charData.texture.orig.width);
      pos.x += charData.xAdvance + this.letterSpacing;
      maxLineHeight = Math.max(maxLineHeight, charData.yOffset + charData.texture.height);
      prevCharCode = charCode;
      if (lastBreakPos !== -1 && maxWidth > 0 && pos.x > maxWidth) {
        ++spacesRemoved;
        removeItems(this.chars, 1 + lastBreakPos - spacesRemoved, 1 + i - lastBreakPos);
        i = lastBreakPos;
        lastBreakPos = -1;
        lineWidths.push(lastBreakWidth);
        lineSpaces.push(this.chars.length > 0 ? this.chars[this.chars.length - 1].prevSpaces : 0);
        maxLineWidth = Math.max(maxLineWidth, lastBreakWidth);
        line++;
        pos.x = 0;
        pos.y += data.lineHeight;
        prevCharCode = null;
        spaceCount = 0;
      }
    }
    const lastChar = charsInput[i]; //charsInput.length - 1];
    if (lastChar !== '\r' && lastChar !== '\n') {
      if (/(?:\s)/.test(lastChar)) {
        lastLineWidth = lastBreakWidth;
      }
      lineWidths.push(lastLineWidth);
      maxLineWidth = Math.max(maxLineWidth, lastLineWidth);
      lineSpaces.push(-1);
    }
    this.lineAlignOffsets = [];
    for (let i = 0; i <= line; i++) {
      let alignOffset = 0;
      if (this.align === 'right') {
        alignOffset = maxLineWidth - lineWidths[i];
      } else if (this.align === 'center') {
        alignOffset = (maxLineWidth - lineWidths[i]) / 2;
      } else if (this.align === 'justify') {
        alignOffset = lineSpaces[i] < 0 ? 0 : (maxLineWidth - lineWidths[i]) / lineSpaces[i];
      }
      this.lineAlignOffsets.push(alignOffset);
    }
    const scale = this.fontSize / data.size;
    this.textWidth = maxLineWidth * scale;
    this.textHeight = (pos.y + data.lineHeight) * scale;
  }
}
