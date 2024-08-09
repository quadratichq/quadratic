/**
 * A CellLabel contains the data necessary to render an individual cell within the Grid.
 * It is never rendered but instead populates LabelMeshes that are rendered.
 *
 * The CellLabel is responsible for calculating the position and style of each glyph within the
 * cell's text. It is also responsible for tracking any overflow of the cell's text. It also
 * populates the buffers for the relevant LabelMeshes based on this data.
 */

import { Bounds } from '@/app/grid/sheet/Bounds';
import { Coordinate } from '@/app/gridGL/types/size';
import { convertColorStringToTint, convertTintToArray } from '@/app/helpers/convertColor';
import { CellAlign, CellVerticalAlign, CellWrap, JsNumber, JsRenderCell } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import { CELL_HEIGHT, CELL_TEXT_MARGIN_LEFT } from '@/shared/constants/gridConstants';
import { removeItems } from '@pixi/utils';
import { Point, Rectangle } from 'pixi.js';
import { RenderBitmapChar } from '../../renderBitmapFonts';
import { CellsLabels } from './CellsLabels';
import { LabelMeshEntry } from './LabelMeshEntry';
import { LabelMeshes } from './LabelMeshes';
import { extractCharCode, splitTextToCharacters } from './bitmapTextUtils';
import { convertNumber, reduceDecimals } from './convertNumber';

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
const LINE_HEIGHT = 16;

// todo: This does not implement RTL overlap clipping or more than 1 cell clipping

// todo: make this part of the cell's style data structure
const fontSize = 14;

export class CellLabel {
  private cellsLabels: CellsLabels;
  private position = new Point();

  visible = true;

  private text: string;
  private originalText: string;

  number?: JsNumber;

  // created in updateFontName()
  private fontName!: string;

  private fontSize: number;
  private tint?: number;
  private maxWidth?: number;
  private roundPixels?: boolean;
  location: Coordinate;
  AABB: Rectangle;

  clipLeft?: number;
  clipRight?: number;

  private cellClipLeft?: number;
  private cellClipRight?: number;
  private cellClipTop?: number;
  private cellClipBottom?: number;

  private nextLeftWidth?: number;
  private nextRightWidth?: number;

  // used by ContainerBitmapText rendering
  private chars: CharRenderData[] = [];
  private horizontalAlignOffsets: number[] = [];

  private align: CellAlign | 'justify';
  private verticalAlign: CellVerticalAlign;
  private wrap: CellWrap;

  private letterSpacing: number;
  private bold: boolean;
  private italic: boolean;

  private textWidth = 0;
  textHeight = 0;
  unwrappedTextWidth = 0;

  overflowRight = 0;
  overflowLeft = 0;

  private actualLeft: number;
  private actualRight: number;

  private getText(cell: JsRenderCell) {
    switch (cell?.special) {
      case 'SpillError':
        return SPILL_ERROR_TEXT;
      case 'RunError':
        return RUN_ERROR_TEXT;
      case 'Chart':
        return CHART_TEXT;
      default:
        if (cell.value !== undefined && cell.number) {
          this.number = cell.number;
          return convertNumber(cell.value, cell.number).toUpperCase();
        } else {
          return cell?.value;
        }
    }
  }

  constructor(cellsLabels: CellsLabels, cell: JsRenderCell, screenRectangle: Rectangle) {
    this.cellsLabels = cellsLabels;
    this.originalText = cell.value;
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

    this.actualLeft = this.AABB.left;
    this.actualRight = this.AABB.right;

    this.bold = !!cell?.bold;
    this.italic = !!cell?.italic || isError || isChart;
    this.updateFontName();
    this.align = cell.align ?? 'left';
    this.verticalAlign = cell.verticalAlign ?? 'top';
    this.wrap = cell.wrap ?? 'overflow';
    this.updateCellLimits();
  }

  private updateFontName = () => {
    const bold = this.bold ? 'Bold' : '';
    const italic = this.italic ? 'Italic' : '';
    this.fontName = `OpenSans${bold || italic ? '-' : ''}${bold}${italic}`;
  };

  private updateCellLimits = () => {
    this.cellClipLeft = this.wrap === 'clip' && this.align !== 'left' ? this.AABB.left : undefined;
    this.cellClipRight = this.wrap === 'clip' && this.align !== 'right' ? this.AABB.right : undefined;
    this.cellClipTop = this.AABB.top;
    this.cellClipBottom = this.AABB.bottom;
    this.maxWidth = this.wrap === 'wrap' ? this.AABB.width - CELL_TEXT_MARGIN_LEFT * 3 : undefined;
  };

  checkLeftClip = (nextLeft: number, labelMeshes: LabelMeshes): boolean => {
    if (this.AABB.left - this.overflowLeft < nextLeft) {
      const nextLeftWidth = this.AABB.right - nextLeft;
      if (this.nextLeftWidth !== nextLeftWidth) {
        this.nextLeftWidth = nextLeftWidth;
        if (this.number !== undefined) {
          this.updateText(labelMeshes);
        }
        return true;
      }
    } else if (this.nextLeftWidth !== undefined) {
      this.nextLeftWidth = undefined;
      if (this.checkNumberClip()) {
        this.updateText(labelMeshes);
      }
      return true;
    }
    return false;
  };

  checkRightClip = (nextRight: number, labelMeshes: LabelMeshes): boolean => {
    if (this.AABB.right + this.overflowRight > nextRight) {
      const nextRightWidth = nextRight - this.AABB.left;
      if (this.nextRightWidth !== nextRightWidth) {
        this.nextRightWidth = nextRightWidth;
        if (this.number !== undefined) {
          this.updateText(labelMeshes);
        }
        return true;
      }
    } else if (this.nextRightWidth !== undefined) {
      this.nextRightWidth = undefined;
      if (this.checkNumberClip()) {
        this.updateText(labelMeshes);
      }
      return true;
    }
    return false;
  };

  checkNumberClip = (): boolean => {
    if (this.number === undefined) return false;

    const clipLeft = Math.max(this.cellClipLeft ?? -Infinity, this.AABB.right - (this.nextLeftWidth ?? Infinity));
    if (this.actualLeft < clipLeft) return true;

    const clipRight = Math.min(this.cellClipRight ?? Infinity, this.AABB.left + (this.nextRightWidth ?? Infinity));
    if (this.actualRight > clipRight) return true;

    return false;
  };

  private calculatePosition = (): void => {
    this.updateCellLimits();

    this.overflowLeft = 0;
    this.overflowRight = 0;
    let alignment = this.align ?? 'left';
    if (alignment === 'right') {
      this.actualLeft = this.AABB.right - this.textWidth;
      this.actualRight = this.actualLeft + this.textWidth;
      if (this.actualLeft < this.AABB.left) {
        this.overflowLeft = this.AABB.left - this.actualLeft;
      }
      this.position = new Point(this.actualLeft, this.AABB.top);
    } else if (alignment === 'center') {
      this.actualLeft = this.AABB.left + (this.AABB.width - this.textWidth) / 2;
      this.actualRight = this.actualLeft + this.textWidth;
      if (this.actualLeft < this.AABB.left) {
        this.overflowLeft = this.AABB.left - this.actualLeft;
      }
      if (this.actualRight > this.AABB.right) {
        this.overflowRight = this.actualRight - this.AABB.right;
      }
      this.position = new Point(this.actualLeft, this.AABB.top);
    } else if (alignment === 'left') {
      this.actualLeft = this.AABB.left;
      this.actualRight = this.AABB.left + this.textWidth;
      if (this.actualRight > this.AABB.right) {
        this.overflowRight = this.actualRight - this.AABB.right;
      }
      this.position = new Point(this.AABB.left, this.AABB.top);
    }

    if (this.verticalAlign === 'bottom') {
      const actualTop = this.AABB.bottom - this.textHeight;
      this.position.y = actualTop;
    } else if (this.verticalAlign === 'middle') {
      const actualTop = Math.max(this.AABB.top, this.AABB.top + (this.AABB.height - this.textHeight) / 2);
      this.position.y = Math.max(actualTop, this.AABB.top);
    }
  };

  public updateText = (labelMeshes: LabelMeshes): void => {
    if (!this.visible) return;

    const processedText = this.processText(labelMeshes, this.text);
    if (!processedText) return;

    this.chars = processedText.chars;
    this.textWidth = processedText.textWidth;
    this.textHeight = processedText.textHeight;
    this.unwrappedTextWidth = processedText.unwrappedTextWidth;
    this.horizontalAlignOffsets = processedText.horizontalAlignOffsets;

    this.calculatePosition();

    // replaces numbers with pound signs when the number overflows
    if (this.checkNumberClip()) {
      const clippedNumber = this.getClippedNumber(this.originalText, this.text, this.number);
      const processedNumberText = this.processText(labelMeshes, clippedNumber);
      if (!processedNumberText) return;

      this.chars = processedNumberText.chars;
      this.textWidth = processedNumberText.textWidth;
      this.textHeight = processedText.textHeight;
      this.horizontalAlignOffsets = processedNumberText.horizontalAlignOffsets;

      this.calculatePosition();
    }
  };

  /** Calculates the text glyphs and positions */
  public processText = (labelMeshes: LabelMeshes, originalText: string) => {
    if (!this.visible) return;

    const data = this.cellsLabels.bitmapFonts[this.fontName];
    if (!data) throw new Error(`Expected BitmapFont ${this.fontName} to be defined in CellLabel.updateText`);

    const pos = new Point();
    const chars = [];
    const lineWidths: number[] = [];
    const lineSpaces: number[] = [];
    const displayText = originalText.replace(/(?:\r\n|\r)/g, '\n') || ' ';
    const charsInput = splitTextToCharacters(displayText);
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
        pos.y += LINE_HEIGHT / scale; // data.lineHeight;
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
        line,
        charCode: charCode,
        prevSpaces: spaceCount,
        position: new Point(pos.x + charData.xOffset + this.letterSpacing / 2, pos.y + charData.yOffset),
      };
      chars.push(charRenderData);
      pos.x += charData.xAdvance + this.letterSpacing;
      prevCharCode = charCode;
      if (maxWidth !== undefined && pos.x - maxWidth / scale > 0.001) {
        const start = lastBreakPos === -1 ? i - spacesRemoved : 1 + lastBreakPos - spacesRemoved;
        const count = lastBreakPos === -1 ? 1 : 1 + i - lastBreakPos;
        removeItems(chars, start, count);

        lastBreakWidth = lastBreakPos === -1 ? lastLineWidth : lastBreakWidth;
        lineWidths.push(lastBreakWidth);
        lineSpaces.push(chars.length > 0 ? chars[chars.length - 1].prevSpaces : 0);
        maxLineWidth = Math.max(maxLineWidth, lastBreakWidth);

        i = lastBreakPos === -1 ? i - 1 : lastBreakPos;
        lastBreakPos = -1;

        line++;
        pos.x = 0;
        pos.y += LINE_HEIGHT / scale; //data.lineHeight;
        prevCharCode = null;
        spaceCount = 0;
      } else {
        lastLineWidth = charRenderData.position.x + Math.max(charData.xAdvance, charData.frame.width);
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

    // calculate the unwrapped text width, content can be multi-line due to \n or \r
    let curUnwrappedTextWidth = 0;
    let maxUnwrappedTextWidth = 0;
    for (let i = 0; i < charsInput.length; i++) {
      const char = charsInput[i];
      if (char === '\r' || char === '\n') {
        maxUnwrappedTextWidth = Math.max(maxUnwrappedTextWidth, curUnwrappedTextWidth);
        curUnwrappedTextWidth = 0;
        continue;
      }
      const charCode = extractCharCode(char);
      const charData = data.chars[charCode];
      if (!charData) continue;
      if (prevCharCode && charData.kerning[prevCharCode]) {
        curUnwrappedTextWidth += charData.kerning[prevCharCode];
      }
      curUnwrappedTextWidth += Math.max(charData.xAdvance, charData.frame.width) + this.letterSpacing;
      maxUnwrappedTextWidth = Math.max(maxUnwrappedTextWidth, curUnwrappedTextWidth);
      prevCharCode = charCode;
    }
    const unwrappedTextWidth = (maxUnwrappedTextWidth + 3 * CELL_TEXT_MARGIN_LEFT) * scale;

    const horizontalAlignOffsets = [];
    for (let i = 0; i <= line; i++) {
      let alignOffset = 0;
      if (this.align === 'right') {
        alignOffset = maxLineWidth - lineWidths[i];
      } else if (this.align === 'center') {
        alignOffset = (maxLineWidth - lineWidths[i]) / 2;
      } else if (this.align === 'justify') {
        alignOffset = lineSpaces[i] < 0 ? 0 : (maxLineWidth - lineWidths[i]) / lineSpaces[i];
      }
      horizontalAlignOffsets.push(alignOffset);
    }

    return {
      chars,
      textWidth: maxLineWidth * scale + OPEN_SANS_FIX.x * 2,
      textHeight: Math.max(textHeight * scale, CELL_HEIGHT),
      unwrappedTextWidth,
      displayText,
      horizontalAlignOffsets,
    };
  };

  // This attempts to reduce the decimal precision to ensure the number fits
  // within the cell. If it doesn't, it shows the pounds
  private getClippedNumber = (originalText: string, text: string, number: JsNumber | undefined): string => {
    if (number === undefined) return text;

    let digits: number | undefined = undefined;
    let infinityProtection = 0;
    do {
      const result = reduceDecimals(originalText, text, number, digits);
      // we cannot reduce decimals anymore, so we show pound characters
      if (!result) return this.getPoundText();

      digits = result.currentFractionDigits - 1;
      text = result.number;
    } while (this.textWidth > this.AABB.width && digits >= 0 && infinityProtection++ < 1000);

    // we were not able to reduce the number to fit the cell, so we show pound characters
    if (digits < 0) return this.getPoundText();

    return text;
  };

  private getPoundText = () => {
    const data = this.cellsLabels.bitmapFonts[this.fontName];
    if (!data) throw new Error(`Expected BitmapFont ${this.fontName} to be defined in CellLabel.updateText`);

    const scale = this.fontSize / data.size;
    const charCode = extractCharCode('#');
    const charData = data.chars[charCode];
    const charWidth = Math.max(charData.xAdvance, charData.frame.width) * scale + this.letterSpacing;
    const count = Math.floor((this.AABB.width - CELL_TEXT_MARGIN_LEFT * 3) / charWidth);
    const text = '#'.repeat(count);
    return text;
  };

  private insertBuffers = (options: {
    buffer: LabelMeshEntry;
    xPos: number;
    yPos: number;
    textureFrame: any;
    textureUvs: any;
    scale: number;
    color?: number[];
    bounds: Bounds;
  }) => {
    const { buffer, xPos, yPos, textureFrame, textureUvs, scale, color, bounds } = options;

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

    bounds.add(xPos, yPos);
    bounds.add(right, bottom);

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
  };

  /** Adds the glyphs to the CellsLabels */
  updateLabelMesh = (labelMeshes: LabelMeshes): Bounds | undefined => {
    if (!this.visible) return;

    const data = this.cellsLabels.bitmapFonts[this.fontName];
    if (!data) throw new Error('Expected BitmapFont to be defined in CellLabel.updateLabelMesh');

    const scale = this.fontSize / data.size;
    const color = this.tint ? convertTintToArray(this.tint) : undefined;

    const bounds = new Bounds();
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
      const clipLeft = Math.max(this.cellClipLeft ?? -Infinity, this.AABB.right - (this.nextLeftWidth ?? Infinity));
      const clipRight = Math.min(this.cellClipRight ?? Infinity, this.AABB.left + (this.nextRightWidth ?? Infinity));

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
        this.insertBuffers({ buffer, bounds, xPos, yPos, textureFrame, textureUvs, scale, color });
      }
    }
    return bounds;
  };

  // these are used to adjust column/row sizes without regenerating glyphs

  adjustX = (delta: number): void => {
    this.AABB.x += delta;
    this.calculatePosition();
  };

  adjustY = (delta: number): void => {
    this.AABB.y += delta;
    this.calculatePosition();
  };

  adjustWidth = (delta: number, negativeX: boolean) => {
    this.AABB.width -= delta;
    if (negativeX) {
      this.AABB.x += delta;
    }
    this.calculatePosition();
  };

  adjustHeight = (delta: number, negativeY: boolean): void => {
    this.AABB.height -= delta;
    if (negativeY) {
      this.AABB.y += delta;
    }
    this.calculatePosition();
  };
}
