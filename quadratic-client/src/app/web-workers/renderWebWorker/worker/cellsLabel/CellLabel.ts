/**
 * A CellLabel contains the data necessary to render an individual cell within the Grid.
 * It is never rendered but instead populates LabelMeshes that are rendered.
 *
 * The CellLabel is responsible for calculating the position and style of each glyph within the
 * cell's text. It is also responsible for tracking any overflow of the cell's text. It also
 * populates the buffers for the relevant LabelMeshes based on this data.
 */

import { Coordinate } from '@/app/gridGL/types/size';
import { convertColorStringToTint, convertTintToArray } from '@/app/helpers/convertColor';
import { CellAlign, CellVerticalAlign, CellWrap, JsRenderCell } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import { CELL_TEXT_MARGIN_LEFT } from '@/shared/constants/gridConstants';
import { removeItems } from '@pixi/utils';
import { Point, Rectangle } from 'pixi.js';
import { RenderBitmapChar } from '../../renderBitmapFonts';
import { CellsLabels } from './CellsLabels';
import { LabelMeshes } from './LabelMeshes';
import { extractCharCode, splitTextToCharacters } from './bitmapTextUtils';

interface CharRenderData {
  charData: RenderBitmapChar;
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

export class CellLabel {
  private cellsLabels: CellsLabels;
  position = new Point();

  visible = true;

  text: string;

  // created in updateFontName()
  fontName!: string;

  fontSize: number;
  tint?: number;
  maxWidth?: number;
  roundPixels?: boolean;
  location: Coordinate;
  AABB: Rectangle;

  clipLeft?: number;
  clipRight?: number;

  cellClipLeft?: number;
  cellClipRight?: number;
  cellClipTop?: number;
  cellClipBottom?: number;

  nextLeft?: number;
  nextRight?: number;

  // used by ContainerBitmapText rendering
  chars: CharRenderData[] = [];
  horizontalAlignOffsets: number[] = [];

  align: CellAlign | 'justify';
  verticalAlign: CellVerticalAlign;
  wrapping: CellWrap;

  letterSpacing: number;
  bold: boolean;
  italic: boolean;

  textWidth = 0;
  textHeight = 0;
  unwrappedTextWidth = 0;

  overflowRight?: number;
  overflowLeft?: number;

  dirty = true;

  private getText(cell: JsRenderCell) {
    switch (cell?.special) {
      case 'SpillError':
        return SPILL_ERROR_TEXT;
      case 'RunError':
        return RUN_ERROR_TEXT;
      case 'Chart':
        return CHART_TEXT;
    }

    // strip any line breaks
    return cell.value.replace(/\n/g, ' ');
  }

  constructor(cellsLabels: CellsLabels, cell: JsRenderCell, screenRectangle: Rectangle) {
    this.cellsLabels = cellsLabels;
    this.text = this.getText(cell);
    this.fontSize = fontSize;
    this.roundPixels = true;
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
    if (cell.special === 'True' || cell.special === 'False') {
      this.text = cell.special === 'True' ? 'TRUE' : 'FALSE';
      cell.align = cell.align ?? 'center';
    }

    this.location = { x: Number(cell.x), y: Number(cell.y) };
    this.AABB = screenRectangle;

    this.bold = !!cell?.bold;
    this.italic = !!cell?.italic || isError || isChart;
    this.updateFontName();
    this.align = cell.align ?? 'left';
    this.verticalAlign = cell.verticalAlign ?? 'top';
    this.wrapping = cell.wrap ?? 'overflow';
    this.updateCellLimits();
  }

  updateFontName() {
    const bold = this.bold ? 'Bold' : '';
    const italic = this.italic ? 'Italic' : '';
    this.fontName = `OpenSans${bold || italic ? '-' : ''}${bold}${italic}`;
  }

  updateCellLimits() {
    this.cellClipLeft = this.wrapping === 'clip' && this.align !== 'left' ? this.AABB.left : undefined;
    this.cellClipRight = this.wrapping === 'clip' && this.align !== 'right' ? this.AABB.right : undefined;
    this.cellClipTop = this.AABB.top;
    this.cellClipBottom = this.AABB.bottom;
    this.maxWidth = this.wrapping === 'wrap' ? this.AABB.width - CELL_TEXT_MARGIN_LEFT * 3 : undefined;
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
    this.align = align ?? 'left';
    this.calculatePosition();
  }

  changeTextColor(color?: string) {
    this.tint = color ? convertColorStringToTint(color) : undefined;
    this.dirty = true;
  }

  checkLeftClip(nextRight: number): boolean {
    if (this.overflowLeft && this.AABB.left - this.overflowLeft < nextRight) {
      if (this.nextRight !== nextRight) {
        this.nextRight = nextRight;
        return true;
      }
    } else if (this.nextRight !== undefined) {
      this.nextRight = undefined;
      return true;
    }
    return false;
  }

  checkRightClip(nextLeft: number): boolean {
    if (this.overflowRight && this.AABB.right + this.overflowRight > nextLeft) {
      if (this.nextLeft !== nextLeft) {
        this.nextLeft = nextLeft;
        return true;
      }
    } else if (this.nextLeft !== undefined) {
      this.nextLeft = undefined;
      return true;
    }
    return false;
  }

  private calculatePosition(): void {
    this.updateCellLimits();

    this.overflowLeft = 0;
    this.overflowRight = 0;
    let alignment = this.align ?? 'left';
    if (alignment === 'right') {
      const actualLeft = this.AABB.right - this.textWidth - OPEN_SANS_FIX.x * 2;
      if (actualLeft < this.AABB.left) {
        this.overflowLeft = this.AABB.left - actualLeft;
      }
      this.position = new Point(actualLeft, this.AABB.top);
    } else if (alignment === 'center') {
      const actualLeft = this.AABB.left + (this.AABB.width - this.textWidth) / 2 - OPEN_SANS_FIX.x;
      const actualRight = actualLeft + this.textWidth;
      if (actualLeft < this.AABB.left) {
        this.overflowLeft = this.AABB.left - actualLeft;
      }
      if (actualRight > this.AABB.right) {
        this.overflowRight = actualRight - this.AABB.right;
      }
      this.position = new Point(actualLeft, this.AABB.top);
    } else if (alignment === 'left') {
      const actualRight = this.AABB.left + this.textWidth;
      if (actualRight > this.AABB.right) {
        this.overflowRight = actualRight - this.AABB.right;
      }
      this.position = new Point(this.AABB.left, this.AABB.top);
    }
  }

  /** Calculates the text glyphs and positions */
  public updateText(labelMeshes: LabelMeshes): void {
    if (!this.visible) return;

    const data = this.cellsLabels.bitmapFonts[this.fontName];
    if (!data) throw new Error(`Expected BitmapFont ${this.fontName} to be defined in CellLabel.updateText`);
    const pos = new Point();
    this.chars = [];
    const lineWidths: number[] = [];
    const lineSpaces: number[] = [];
    const text = this.text.replace(/(?:\r\n|\r)/g, '\n') || ' ';
    const charsInput = splitTextToCharacters(text);
    const scale = this.fontSize / data.size;
    const maxWidth = this.maxWidth;
    let prevCharCode = null;
    let lastLineWidth = 0;
    let maxLineWidth = 0;
    let textHeight = 0;
    let line = 0;
    let lastBreakPos = -1;
    let lastBreakWidth = 0;
    let spacesRemoved = 0;
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
        spacesRemoved++;
        lastBreakPos = -1;
        lineWidths.push(lastLineWidth);
        lineSpaces.push(-1);
        maxLineWidth = Math.max(maxLineWidth, lastLineWidth);

        line++;
        pos.x = 0;
        pos.y += data.lineHeight;
        prevCharCode = null;
        spaceCount = 0;
        continue;
      }
      const charData = data.chars[charCode];
      if (!charData) continue;

      const labelMeshId = labelMeshes.add(this.fontName, fontSize, charData.textureUid, !!this.tint);
      if (prevCharCode && charData.kerning[prevCharCode]) {
        pos.x += charData.kerning[prevCharCode];
      }
      const charRenderData: CharRenderData = {
        labelMeshId,
        charData,
        line: line,
        charCode: charCode,
        prevSpaces: spaceCount,
        position: new Point(pos.x + charData.xOffset + this.letterSpacing / 2, pos.y + charData.yOffset),
      };
      this.chars.push(charRenderData);
      pos.x += charData.xAdvance + this.letterSpacing;
      prevCharCode = charCode;
      if (maxWidth !== undefined && pos.x > maxWidth / scale) {
        const start = lastBreakPos === -1 ? i - spacesRemoved : 1 + lastBreakPos - spacesRemoved;
        const count = lastBreakPos === -1 ? 1 : 1 + i - lastBreakPos;
        removeItems(this.chars, start, count);

        lastBreakWidth = lastBreakPos === -1 ? lastLineWidth : lastBreakWidth;
        lineWidths.push(lastBreakWidth);
        lineSpaces.push(this.chars.length > 0 ? this.chars[this.chars.length - 1].prevSpaces : 0);
        maxLineWidth = Math.max(maxLineWidth, lastBreakWidth);

        i = lastBreakPos === -1 ? i - 1 : lastBreakPos;
        lastBreakPos = -1;

        line++;
        pos.x = 0;
        pos.y += data.lineHeight;
        prevCharCode = null;
        spaceCount = 0;
      } else {
        lastLineWidth = charRenderData.position.x + Math.max(charData.xAdvance, charData.origWidth);
        textHeight = Math.max(textHeight, charRenderData.position.y + charData.textureHeight);
      }
    }

    const lastChar = charsInput[i];
    if (lastChar !== '\r' && lastChar !== '\n') {
      if (/(?:\s)/.test(lastChar)) {
        lastLineWidth = lastBreakWidth;
      }
      lineWidths.push(lastLineWidth);
      lineSpaces.push(-1);
      maxLineWidth = Math.max(maxLineWidth, lastLineWidth);
    }

    this.textWidth = maxLineWidth * scale;
    this.textHeight = textHeight * scale;

    // calculate the unwrapped text width
    // content can be multi-line due to \n or \r, this corresponds to lineSpaces[i] === -1
    let curUnwrappedTextWidth = 0;
    let maxUnwrappedTextWidth = 0;
    for (let i = 0; i < lineWidths.length; i++) {
      curUnwrappedTextWidth += lineWidths[i];
      if (lineSpaces[i] === -1) {
        maxUnwrappedTextWidth = Math.max(maxUnwrappedTextWidth, curUnwrappedTextWidth);
        curUnwrappedTextWidth = 0;
      }
    }
    this.unwrappedTextWidth = (maxUnwrappedTextWidth + 3 * CELL_TEXT_MARGIN_LEFT) * scale;

    this.horizontalAlignOffsets = [];
    for (let i = 0; i <= line; i++) {
      let alignOffset = 0;
      if (this.align === 'right') {
        alignOffset = maxLineWidth - lineWidths[i];
      } else if (this.align === 'center') {
        alignOffset = (maxLineWidth - lineWidths[i]) / 2;
      } else if (this.align === 'justify') {
        alignOffset = lineSpaces[i] < 0 ? 0 : (maxLineWidth - lineWidths[i]) / lineSpaces[i];
      }
      this.horizontalAlignOffsets.push(alignOffset);
    }

    this.calculatePosition();
  }

  /** Adds the glyphs to the CellsLabels */
  updateLabelMesh(labelMeshes: LabelMeshes): { minX: number; minY: number; maxX: number; maxY: number } | undefined {
    if (!this.visible) return;

    const data = this.cellsLabels.bitmapFonts[this.fontName];
    if (!data) throw new Error('Expected BitmapFont to be defined in CellLabel.updateLabelMesh');
    const scale = this.fontSize / data.size;
    const color = this.tint ? convertTintToArray(this.tint) : undefined;

    // keep track of the min/max x/y values for the viewRectangle
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (let i = 0; i < this.chars.length; i++) {
      const char = this.chars[i];
      let horizontalOffset =
        char.position.x + this.horizontalAlignOffsets[char.line] * (this.align === 'justify' ? char.prevSpaces : 1);
      if (this.roundPixels) {
        horizontalOffset = Math.round(horizontalOffset);
      }
      const xPos = this.position.x + horizontalOffset * scale + OPEN_SANS_FIX.x;
      const yPos = this.position.y + char.position.y * scale + OPEN_SANS_FIX.y;
      const labelMesh = labelMeshes.get(char.labelMeshId);
      const textureFrame = char.charData.frame;
      const textureUvs = char.charData.uvs;
      const buffer = labelMesh.getBuffer();
      const clipLeft = Math.max(this.cellClipLeft ?? -Infinity, this.nextRight ?? -Infinity);
      const clipRight = Math.min(this.cellClipRight ?? Infinity, this.nextLeft ?? Infinity);

      // remove letters that are outside the clipping bounds
      if (
        xPos <= clipLeft ||
        xPos + textureFrame.width * scale >= clipRight ||
        (this.cellClipTop !== undefined && yPos <= this.cellClipTop) ||
        (this.cellClipBottom !== undefined && yPos + textureFrame.height * scale >= this.cellClipBottom)
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

        minX = Math.min(minX, xPos);
        minY = Math.min(minY, yPos);
        maxX = Math.max(maxX, right);
        maxY = Math.max(maxY, bottom);

        buffers.uvs![index * 8 + 0] = textureUvs[0];
        buffers.uvs![index * 8 + 1] = textureUvs[1];
        buffers.uvs![index * 8 + 2] = textureUvs[2];
        buffers.uvs![index * 8 + 3] = textureUvs[3];
        buffers.uvs![index * 8 + 4] = textureUvs[4];
        buffers.uvs![index * 8 + 5] = textureUvs[5];
        buffers.uvs![index * 8 + 6] = textureUvs[6];
        buffers.uvs![index * 8 + 7] = textureUvs[7];

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
    return { minX, minY, maxX, maxY };
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

  adjustWidth(delta: number, negativeX: boolean) {
    this.AABB.width -= delta;
    if (negativeX) {
      this.AABB.x += delta;
    }
    this.calculatePosition();
  }

  adjustHeight(delta: number, negativeY: boolean): void {
    this.AABB.height -= delta;
    if (negativeY) {
      this.AABB.y += delta;
    }
    this.calculatePosition();
  }
}
