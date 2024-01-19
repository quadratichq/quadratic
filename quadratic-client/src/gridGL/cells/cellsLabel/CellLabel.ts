import { colors } from '@/theme/colors';
import { removeItems } from '@pixi/utils';
import { BitmapFont, Container, Point, Rectangle, Texture } from 'pixi.js';
import { Bounds } from '../../../grid/sheet/Bounds';
import { convertColorStringToTint, convertTintToArray } from '../../../helpers/convertColor';
import { CellAlign, JsRenderCell } from '../../../quadratic-core/types';
import { CellAlignment } from '../../../schemas';
import { Coordinate } from '../../types/size';
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

// magic numbers to make the WebGL rendering of OpenSans look similar to the HTML version
const OPEN_SANS_FIX = { x: 1.8, y: -1 };
const SPILL_ERROR_TEXT = ' #SPILL';
const RUN_ERROR_TEXT = ' #ERROR';
const CHART_TEXT = ' CHART';

// todo: This does not implement RTL overlap clipping or more than 1 cell clipping

// todo: make this part of the cell's style data structure
const fontSize = 14;

export class CellLabel extends Container {
  text: string;

  // created in updateFontName()
  fontName!: string;

  fontSize: number;
  tint?: number;
  maxWidth: number;
  roundPixels?: boolean;
  location: Coordinate;
  AABB: Rectangle;

  clipLeft: number | undefined;
  clipRight: number | undefined;

  // used by ContainerBitmapText rendering
  chars: CharRenderData[] = [];
  lineAlignOffsets: number[] = [];
  align?: 'left' | 'right' | 'justify' | 'center';
  letterSpacing: number;
  bold: boolean;
  italic: boolean;

  textWidth = 0;
  textHeight = 0;

  overflowRight?: number;
  overflowLeft?: number;

  alignment: CellAlignment;

  dirty = true;

  private getText(cell: JsRenderCell) {
    switch (cell?.special) {
      case 'SpillError':
        return SPILL_ERROR_TEXT;
      case 'RunError':
        return RUN_ERROR_TEXT;
      case 'Chart':
        return CHART_TEXT;
      default:
        return cell?.value;
    }
  }

  constructor(cell: JsRenderCell, screenRectangle: Rectangle) {
    super();
    this.text = this.getText(cell);
    this.fontSize = fontSize;
    this.roundPixels = true;
    this.maxWidth = 0;
    this.letterSpacing = 0;
    const isError = cell?.special === 'SpillError' || cell?.special === 'RunError';
    const isChart = cell?.special === 'Chart';
    if (isError) {
      this.tint = colors.cellColorError;
    } else if (isChart) {
      this.tint = convertColorStringToTint(colors.languagePython);
    } else if (cell?.textColor) {
      this.tint = convertColorStringToTint(cell.textColor);
    } else {
      this.tint = 0;
    }

    this.location = { x: Number(cell.x), y: Number(cell.y) };
    this.AABB = screenRectangle;
    this.position.set(screenRectangle.x, screenRectangle.y);

    this.bold = !!cell?.bold;
    this.italic = !!cell?.italic || isError || isChart;
    this.updateFontName();
    this.alignment = cell.align;
  }

  updateFontName() {
    const bold = this.bold ? 'Bold' : '';
    const italic = this.italic ? 'Italic' : '';
    this.fontName = `OpenSans${bold || italic ? '-' : ''}${bold}${italic}`;
  }

  changeBold(bold?: boolean) {
    this.bold = !!bold;
    this.updateFontName();
    this.dirty = true;
  }

  changeItalic(italic?: boolean) {
    this.italic = !!italic;
    this.updateFontName();
    this.dirty = true;
  }

  changeAlign(align?: CellAlign) {
    this.alignment = align ?? 'left';
    this.calculatePosition();
  }

  changeTextColor(color?: string) {
    this.tint = color ? convertColorStringToTint(color) : undefined;
    this.dirty = true;
  }

  get cellWidth(): number {
    return this.AABB.width;
  }

  checkLeftClip(left: number): void {
    if (this.overflowLeft && this.AABB.left - this.overflowLeft < left) {
      this.clipLeft = left;
    } else {
      this.clipLeft = undefined;
    }
  }

  checkRightClip(nextLeft: number): void {
    if (this.overflowRight && this.AABB.right + this.overflowRight > nextLeft) {
      this.clipRight = nextLeft;
    } else {
      this.clipRight = undefined;
    }
  }

  private calculatePosition(): void {
    this.overflowLeft = 0;
    this.overflowRight = 0;
    let alignment = this.alignment ?? 'left';
    if (alignment === 'right') {
      const actualLeft = this.AABB.x + this.cellWidth - this.textWidth - OPEN_SANS_FIX.x * 2;
      if (actualLeft < this.AABB.x) {
        this.overflowLeft = this.AABB.x - actualLeft;
      }
      this.position = new Point(actualLeft, this.AABB.y);
    } else if (alignment === 'center') {
      const actualLeft = this.AABB.x + this.cellWidth / 2 - this.textWidth / 2;
      const actualRight = actualLeft + this.textWidth;
      if (actualLeft < this.AABB.x) {
        this.overflowLeft = this.AABB.x - actualLeft;
      }
      if (actualRight > this.AABB.right) {
        this.overflowRight = actualRight - this.AABB.right;
      } else {
      }
      this.position = new Point(actualLeft, this.AABB.y);
    } else if (alignment === 'left') {
      const actualRight = this.AABB.x + this.textWidth;
      if (actualRight > this.AABB.right) {
        this.overflowRight = actualRight - this.AABB.right;
      }
      this.position = new Point(this.AABB.x, this.AABB.y);
    }
  }

  /** Calculates the text glyphs and positions */
  public updateText(labelMeshes: LabelMeshes): void {
    // visible is false when a cell is being edited
    if (this.visible === false) return;

    const data = BitmapFont.available[this.fontName];
    if (!data) throw new Error('Expected BitmapFont to be defined in CellLabel.updateText');
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

      const labelMeshId = labelMeshes.add(this.fontName, fontSize, charData.texture, !!this.tint);
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
    const lastChar = charsInput[i];
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

    this.calculatePosition();
  }

  /** Adds the glyphs to the CellsLabels container */
  updateLabelMesh(labelMeshes: LabelMeshes): Bounds {
    const bounds = new Bounds();

    // visible is only used to hide a cell label when a cell is being edited
    if (this.visible === false) {
      return bounds;
    }

    const data = BitmapFont.available[this.fontName];
    const scale = this.fontSize / data.size;
    const color = this.tint ? convertTintToArray(this.tint) : undefined;
    for (let i = 0; i < this.chars.length; i++) {
      const char = this.chars[i];
      let offset =
        char.position.x + this.lineAlignOffsets[char.line] * (this.align === 'justify' ? char.prevSpaces : 1);
      if (this.roundPixels) {
        offset = Math.round(offset);
      }
      const xPos = this.position.x + offset * scale + OPEN_SANS_FIX.x;
      const yPos = this.position.y + char.position.y * scale + OPEN_SANS_FIX.y;
      const labelMesh = labelMeshes.get(char.labelMeshId);
      const texture = char.texture;
      const textureFrame = texture.frame;
      const textureUvs = texture._uvs;
      const buffer = labelMesh.getBuffer();

      // remove letters that are outside the clipping bounds
      if (
        (this.clipRight !== undefined && xPos + textureFrame.width * scale >= this.clipRight) ||
        (this.clipLeft !== undefined && xPos <= this.clipLeft)
      ) {
        // this removes extra characters from the mesh after a clip
        buffer.reduceSize(6);
      } else {
        const index = buffer.index;
        const buffers = buffer;

        buffers.indices![index * 6 + 0] = 0 + index * 4;
        buffers.indices![index * 6 + 1] = 1 + index * 4;
        buffers.indices![index * 6 + 2] = 2 + index * 4;
        buffers.indices![index * 6 + 3] = 0 + index * 4;
        buffers.indices![index * 6 + 4] = 2 + index * 4;
        buffers.indices![index * 6 + 5] = 3 + index * 4;

        buffers.vertices![index * 8 + 0] = xPos;
        buffers.vertices![index * 8 + 1] = yPos;
        const right = xPos + textureFrame.width * scale;
        buffers.vertices![index * 8 + 2] = right;
        buffers.vertices![index * 8 + 3] = yPos;
        buffers.vertices![index * 8 + 4] = right;
        const bottom = yPos + textureFrame.height * scale;
        buffers.vertices![index * 8 + 5] = bottom;
        buffers.vertices![index * 8 + 6] = xPos;
        buffers.vertices![index * 8 + 7] = bottom;

        buffers.uvs![index * 8 + 0] = textureUvs.x0;
        buffers.uvs![index * 8 + 1] = textureUvs.y0;
        buffers.uvs![index * 8 + 2] = textureUvs.x1;
        buffers.uvs![index * 8 + 3] = textureUvs.y1;
        buffers.uvs![index * 8 + 4] = textureUvs.x2;
        buffers.uvs![index * 8 + 5] = textureUvs.y2;
        buffers.uvs![index * 8 + 6] = textureUvs.x3;
        buffers.uvs![index * 8 + 7] = textureUvs.y3;

        bounds.addRectanglePoints(xPos, yPos, right, bottom);

        if (color) {
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
        buffer.index++;
      }
    }
    return bounds;
  }

  // these are used to adjust column/row sizes without regenerating glyphs

  adjustX(delta: number): void {
    this.AABB.x += delta;
    this.calculatePosition();
  }

  adjustY(delta: number): void {
    this.AABB.y += delta;
    this.calculatePosition();
  }

  adjustWidth(delta: number, adjustX?: boolean): void {
    this.AABB.width += delta;
    if (adjustX) {
      this.AABB.x -= delta;
    }
    this.calculatePosition();
  }

  adjustHeight(delta: number, adjustY?: boolean): void {
    this.AABB.height += delta;
    if (adjustY) {
      this.AABB.y -= delta;
    }
    this.calculatePosition();
  }
}
