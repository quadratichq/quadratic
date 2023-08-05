import { removeItems } from '@pixi/utils';
import { BitmapFont, Container, Point, Rectangle, Texture } from 'pixi.js';
import { convertColorStringToTint, convertTintToArray } from '../../../helpers/convertColor';
import { CellAlignment } from '../../../schemas';
import { CellsHash } from '../CellsHash';
import { CellHash, CellRust } from '../CellsTypes';
import { CellsLabels } from './CellsLabels';
import { LabelMeshes } from './LabelMeshes';
import { extractCharCode, splitTextToCharacters } from './bitmapTextUtils';

interface CharRenderData {
  texture: Texture;
  labelMeshId: string;
  line: number;
  charCode: number;
  position: Point;
  prevSpaces: number;
}

// todo: This does not implement RTL overlap clipping or more than 1 cell clipping

// todo: make this part of the cell's style data structure
const fontSize = 14;

export class CellLabel extends Container implements CellHash {
  private cellsLabels: CellsLabels;

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

  overflowRight?: number;
  overflowLeft?: number;

  // the topLeft position of the cell (ignores changes to position -- eg, align: right does not effect it)
  topLeft: Point;

  // cell's actual width (different from overflowed textWidth)
  cellWidth: number;

  // the right position of the cell
  right: number;

  alignment: CellAlignment;

  // used by CellHash
  AABB?: Rectangle;
  hashes = new Set<CellsHash>();

  dirty = true;

  // cache for clip to avoid recalculation of same clip
  private lastClip: { clipLeft?: number; clipRight?: number } | undefined;

  constructor(cellsLabels: CellsLabels, cell: CellRust, rectangle: Rectangle) {
    super();
    this.cellsLabels = cellsLabels;
    this.text = cell.value.toString();
    this.fontSize = fontSize;
    this.roundPixels = true;
    this.maxWidth = 0;
    this.letterSpacing = 0;
    this.tint = cell?.textColor ? convertColorStringToTint(cell.textColor) : 0;

    this.AABB = rectangle;
    this.cellWidth = rectangle.width;
    this.topLeft = new Point(rectangle.x, rectangle.y);
    this.right = rectangle.right;
    this.position.set(rectangle.x, rectangle.y);

    const bold = cell?.bold ? 'Bold' : '';
    const italic = cell?.italic ? 'Italic' : '';
    this.fontName = `OpenSans${bold || italic ? '-' : ''}${bold}${italic}`;
    this.alignment = cell.align;
  }

  /**
   * Changes the clip settings for the text -- only forces a redraw of the text if the clipOptions have changed
   * @param options
   * @returns
   */
  setClip(options?: { clipLeft?: number; clipRight?: number }): void {
    if (!options && !this.lastClip) return;
    if (
      options &&
      this.lastClip &&
      options.clipLeft === this.lastClip.clipLeft &&
      options.clipRight === this.lastClip.clipRight
    )
      return;
    this.clipLeft = options?.clipLeft;
    this.clipRight = options?.clipRight;
    this.lastClip = options;
    this.dirty = true;
  }

  private calculatePosition(): Point {
    let alignment = this.alignment ?? 'left';
    if (alignment === 'right') {
      return new Point(this.topLeft.x + this.right - this.textWidth, this.topLeft.y);
    } else if (alignment === 'center') {
      return new Point(this.topLeft.x + this.right / 2 - this.textWidth / 2, this.topLeft.y);
    }
    return this.topLeft;
  }

  /** Calculates the text glyphs and positions and tracks whether the text overflows the cell */
  public updateText(labelMeshes: LabelMeshes): void {
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
      if (!charData) continue;

      const labelMeshId = labelMeshes.add(this.fontName, fontSize, charData.texture);
      if (prevCharCode && charData.kerning[prevCharCode]) {
        pos.x += charData.kerning[prevCharCode];
      }
      const charRenderData: CharRenderData = {
        labelMeshId,
        texture: charData.texture,
        line: line,
        charCode: charCode,
        prevSpaces: spaceCount,
        position: new Point(pos.x + charData.xOffset + this.letterSpacing / 2, pos.y + charData.yOffset),
      };
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
    const lastChar = charsInput[i]; // charsInput.length - 1];
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

    this.position = this.calculatePosition();
  }

  /** Adds the glyphs to the CellsLabels container */
  updateLabelMesh(labelMeshes: LabelMeshes): void {
    const data = BitmapFont.available[this.fontName];
    const scale = this.fontSize / data.size;
    const color = convertTintToArray(this.tint ?? 0);
    for (let i = 0; i < this.chars.length; i++) {
      const char = this.chars[i];
      let offset =
        char.position.x + this.lineAlignOffsets[char.line] * (this.align === 'justify' ? char.prevSpaces : 1);
      if (this.roundPixels) {
        offset = Math.round(offset);
      }
      const xPos = this.position.x + offset * scale;
      const yPos = this.position.y + char.position.y * scale;
      const labelMesh = labelMeshes.get(char.labelMeshId);
      const texture = char.texture;
      const textureFrame = texture.frame;
      const textureUvs = texture._uvs;

      // remove letters that are outside the clipping bounds
      if (
        (this.clipRight !== undefined && xPos + textureFrame.width * scale + this.x >= this.clipRight) ||
        (this.clipLeft !== undefined && xPos + this.x <= this.clipLeft)
      ) {
        // todo: this should remove the correct size from the array...
        // this removes extra characters from the mesh after a clip
        labelMesh.size -= 6;
      } else {
        const index = labelMesh.index++;
        const buffers = labelMesh;

        buffers.indices![index * 6 + 0] = 0 + index * 4;
        buffers.indices![index * 6 + 1] = 1 + index * 4;
        buffers.indices![index * 6 + 2] = 2 + index * 4;
        buffers.indices![index * 6 + 3] = 0 + index * 4;
        buffers.indices![index * 6 + 4] = 2 + index * 4;
        buffers.indices![index * 6 + 5] = 3 + index * 4;

        buffers.vertices![index * 8 + 0] = xPos;
        buffers.vertices![index * 8 + 1] = yPos;
        buffers.vertices![index * 8 + 2] = xPos + textureFrame.width * scale;
        buffers.vertices![index * 8 + 3] = yPos;
        buffers.vertices![index * 8 + 4] = xPos + textureFrame.width * scale;
        buffers.vertices![index * 8 + 5] = yPos + textureFrame.height * scale;
        buffers.vertices![index * 8 + 6] = xPos;
        buffers.vertices![index * 8 + 7] = yPos + textureFrame.height * scale;

        buffers.uvs![index * 8 + 0] = textureUvs.x0;
        buffers.uvs![index * 8 + 1] = textureUvs.y0;
        buffers.uvs![index * 8 + 2] = textureUvs.x1;
        buffers.uvs![index * 8 + 3] = textureUvs.y1;
        buffers.uvs![index * 8 + 4] = textureUvs.x2;
        buffers.uvs![index * 8 + 5] = textureUvs.y2;
        buffers.uvs![index * 8 + 6] = textureUvs.x3;
        buffers.uvs![index * 8 + 7] = textureUvs.y3;

        buffers.colors![index * 16 + 0] = color[0];
        buffers.colors![index * 16 + 1] = color[1];
        buffers.colors![index * 16 + 2] = color[2];
        buffers.colors![index * 16 + 3] = color[3];
        buffers.colors![index * 16 + 4] = color[0];
        buffers.colors![index * 16 + 5] = color[1];
        buffers.colors![index * 16 + 6] = color[2];
        buffers.colors![index * 16 + 7] = color[3];
        buffers.colors![index * 16 + 8] = color[0];
        buffers.colors![index * 16 + 9] = color[1];
        buffers.colors![index * 16 + 10] = color[2];
        buffers.colors![index * 16 + 11] = color[3];
        buffers.colors![index * 16 + 12] = color[0];
        buffers.colors![index * 16 + 13] = color[1];
        buffers.colors![index * 16 + 14] = color[2];
        buffers.colors![index * 16 + 15] = color[3];
      }
    }
  }
}
