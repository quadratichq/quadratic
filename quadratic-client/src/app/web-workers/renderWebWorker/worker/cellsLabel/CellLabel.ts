/**
 * A CellLabel contains the data necessary to render an individual cell within the Grid.
 * It is never rendered but instead populates LabelMeshes that are rendered.
 *
 * The CellLabel is responsible for calculating the position and style of each glyph within the
 * cell's text. It is also responsible for tracking any overflow of the cell's text. It also
 * populates the buffers for the relevant LabelMeshes based on this data.
 */

import { Bounds } from '@/app/grid/sheet/Bounds';
import { DROPDOWN_PADDING, DROPDOWN_SIZE } from '@/app/gridGL/cells/cellsLabel/drawSpecial';
import { emojiCodePoints } from '@/app/gridGL/pixiApp/emojis/emojiMap';
import { convertColorStringToTint, convertTintToArray } from '@/app/helpers/convertColor';
import { isFloatGreaterThan, isFloatLessThan } from '@/app/helpers/float';
import type {
  CellAlign,
  CellVerticalAlign,
  CellWrap,
  JsCoordinate,
  JsNumber,
  JsRenderCell,
} from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import type { RenderBitmapChar } from '@/app/web-workers/renderWebWorker/renderBitmapFonts';
import {
  extractCharCode,
  splitTextToCharacters,
} from '@/app/web-workers/renderWebWorker/worker/cellsLabel/bitmapTextUtils';
import type { CellsLabels } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellsLabels';
import type { RenderEmoji } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellsTextHashSpecial';
import { convertNumber, reduceDecimals } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/convertNumber';
import type { LabelMeshEntry } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/LabelMeshEntry';
import type { LabelMeshes } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/LabelMeshes';
import {
  CELL_HEIGHT,
  CELL_TEXT_MARGIN_LEFT,
  CELL_WIDTH,
  MIN_CELL_WIDTH,
  SORT_BUTTON_PADDING,
  SORT_BUTTON_RADIUS,
} from '@/shared/constants/gridConstants';
import { removeItems } from '@pixi/utils';
import { Point, Rectangle } from 'pixi.js';

interface CharRenderData {
  charData: RenderBitmapChar;
  labelMeshId: string;
  line: number;
  charCode: number;
  position: Point;
  prevSpaces: number;
}

// Maximum number of characters to render per cell
const MAX_CHAR_LENGTH = 1000;

// magic numbers to make the WebGL rendering of OpenSans look similar to the HTML version
export const OPEN_SANS_FIX = { x: 1.8, y: -1.8 };

const SPILL_ERROR_TEXT = ' #SPILL';
const RUN_ERROR_TEXT = ' #ERROR';

// values based on line position and thickness in monaco editor
const HORIZONTAL_LINE_THICKNESS = 1;
const UNDERLINE_OFFSET = 52;
const STRIKE_THROUGH_OFFSET = 32;

// todo: This does not implement RTL overlap clipping or more than 1 cell clipping

// todo: make this part of the cell's style data structure
export const FONT_SIZE = 14;
export const LINE_HEIGHT = 16;

const URL_REGEX = /^(https?:\/\/|www\.)[^\s<>'"]+\.[^\s<>'"]+$/i;

export class CellLabel {
  private cellsLabels: CellsLabels;
  private position = new Point();

  visible = true;

  text: string;
  private originalText: string;

  number?: JsNumber;

  // created in updateFontName()
  private fontName!: string;

  private fontSize: number;
  tint: number;
  private maxWidth?: number;
  private roundPixels?: boolean;
  location: JsCoordinate;
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
  private lineWidths: number[] = [];
  horizontalLines: Rectangle[] = [];

  private align: CellAlign | 'justify';
  private verticalAlign: CellVerticalAlign;
  private wrap: CellWrap;

  private letterSpacing: number;
  private bold: boolean;
  private italic: boolean;

  link: boolean;
  private underline: boolean;
  private strikeThrough: boolean;

  private textWidth = 0;
  textHeight = CELL_HEIGHT;
  unwrappedTextWidth = CELL_WIDTH;

  // overflow values
  private overflowRight = 0;
  private overflowLeft = 0;

  // bounds with overflow
  private actualLeft: number;
  private actualRight: number;
  private actualTop: number;
  private actualBottom: number;

  // bounds after clipping
  textLeft: number;
  textRight: number;
  private textTop: number;
  private textBottom: number;

  private tableName: boolean;
  private columnHeader: boolean;

  emojis: RenderEmoji[];

  private getText = (cell: JsRenderCell) => {
    let text = '';
    switch (cell?.special) {
      case 'SpillError':
        text = SPILL_ERROR_TEXT;
        break;
      case 'RunError':
        text = RUN_ERROR_TEXT;
        break;
      case 'Chart':
        text = '';
        break;
      case 'Checkbox':
        text = '';
        break;
      default:
        if (cell.value !== undefined && cell.number) {
          this.number = cell.number;
          text = convertNumber(cell.value, cell.number).toUpperCase();
        } else {
          this.number = undefined;
          text = cell?.value;
        }
    }
    if (text.length > MAX_CHAR_LENGTH) {
      text = text.substring(0, MAX_CHAR_LENGTH - 1) + '…';
    }
    return text;
  };

  get textRectangle() {
    return new Rectangle(this.textLeft, this.textTop, this.textRight - this.textLeft, this.textBottom - this.textTop);
  }

  constructor(cellsLabels: CellsLabels, cell: JsRenderCell, screenRectangle: Rectangle) {
    this.cellsLabels = cellsLabels;
    this.originalText = cell.value;
    this.text = this.getText(cell);
    this.link = this.isLink(cell);
    this.fontSize = FONT_SIZE;
    this.roundPixels = true;
    this.letterSpacing = 0;
    const isDropdown = cell.special === 'List';
    const isError = cell.special === 'SpillError' || cell.special === 'RunError';
    const isChart = cell.special === 'Chart';
    if (isError) {
      this.tint = colors.cellColorError;
    } else if (isChart) {
      this.tint = convertColorStringToTint(colors.languagePython);
    } else if (cell?.textColor) {
      this.tint = convertColorStringToTint(cell.textColor);
    } else if (this.link) {
      this.tint = convertColorStringToTint(colors.link);
    } else {
      this.tint = 0;
    }
    if (cell.special === 'Logical') {
      this.text = cell.value === 'true' ? 'TRUE' : 'FALSE';
      cell.align = cell.align ?? 'center';
    }

    this.emojis = [];

    this.location = { x: Number(cell.x), y: Number(cell.y) };
    this.AABB = screenRectangle;

    // need to adjust the right side of the AABB to account for the dropdown indicator
    if (isDropdown) {
      this.AABB.width -= DROPDOWN_SIZE[0] + DROPDOWN_PADDING[0];
    }

    this.actualLeft = this.AABB.left;
    this.actualRight = this.AABB.right;
    this.actualTop = this.AABB.top;
    this.actualBottom = this.AABB.bottom;

    this.textLeft = this.AABB.left;
    this.textRight = this.AABB.right;
    this.textTop = this.AABB.top;
    this.textBottom = this.AABB.bottom;

    this.bold = !!cell?.bold;
    this.italic = !!cell?.italic || isError || isChart;
    this.updateFontName();
    this.align = cell.align ?? 'left';
    this.verticalAlign = cell.verticalAlign ?? 'top';
    this.wrap = cell.wrap === undefined && this.isNumber() ? 'clip' : (cell.wrap ?? 'overflow');
    this.underline = cell.underline ?? this.link;
    this.strikeThrough = !!cell.strikeThrough;
    this.tableName = !!cell.tableName;
    this.columnHeader = !!cell.columnHeader;
    this.updateCellLimits();
  }

  private updateFontName = () => {
    const bold = this.bold ? 'Bold' : '';
    const italic = this.italic ? 'Italic' : '';
    this.fontName = `OpenSans${bold || italic ? '-' : ''}${bold}${italic}`;
  };

  private updateCellLimits = () => {
    this.cellClipLeft =
      (this.wrap === 'clip' && this.align !== 'left') || this.location.x === 1 ? this.AABB.left : undefined;
    this.cellClipRight = this.wrap === 'clip' && this.align !== 'right' ? this.AABB.right : undefined;
    this.cellClipTop = this.AABB.top;
    this.cellClipBottom = this.AABB.bottom;
    this.maxWidth = this.wrap === 'wrap' ? this.AABB.width - CELL_TEXT_MARGIN_LEFT * 3 : undefined;
  };

  private isLink = (cell: JsRenderCell): boolean => {
    if (cell.number !== undefined || cell.special !== undefined) return false;
    if (!URL_REGEX.test(cell.value)) return false;
    try {
      new URL(cell.value);
      return true;
    } catch (e) {
      return false;
    }
  };

  private isNumber = (): boolean => {
    return this.number !== undefined;
  };

  checkLeftClip = (nextLeft: number, labelMeshes: LabelMeshes): boolean => {
    if (this.AABB.left - this.overflowLeft < nextLeft) {
      const nextLeftWidth = this.AABB.right - nextLeft;
      if (this.nextLeftWidth !== nextLeftWidth) {
        this.nextLeftWidth = nextLeftWidth;
        if (this.isNumber()) {
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
        if (this.isNumber()) {
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

  private checkNumberClip = (): boolean => {
    if (!this.isNumber()) return false;

    const clipLeft = Math.max(this.cellClipLeft ?? -Infinity, this.AABB.right - (this.nextLeftWidth ?? Infinity));
    if (isFloatLessThan(this.actualLeft, clipLeft)) return true;

    const clipRight = Math.min(this.cellClipRight ?? Infinity, this.AABB.left + (this.nextRightWidth ?? Infinity));
    if (isFloatGreaterThan(this.actualRight, clipRight)) return true;

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
      this.actualTop = this.position.y;
    } else if (this.verticalAlign === 'middle') {
      const actualTop = Math.max(this.AABB.top, this.AABB.top + (this.AABB.height - this.textHeight) / 2);
      this.position.y = Math.max(actualTop, this.AABB.top);
      this.actualTop = this.position.y;
    } else {
      this.actualTop = this.position.y;
    }
    this.actualBottom = Math.min(this.AABB.bottom, this.position.y + this.textHeight);
  };

  updateText = (labelMeshes: LabelMeshes): void => {
    if (!this.visible) return;

    let processedText = this.processText(labelMeshes, this.text);
    if (!processedText) return;

    this.chars = processedText.chars;
    this.textWidth = processedText.textWidth;
    this.textHeight = processedText.textHeight;
    this.horizontalAlignOffsets = processedText.horizontalAlignOffsets;
    this.lineWidths = processedText.lineWidths;
    this.unwrappedTextWidth = this.getUnwrappedTextWidth(this.text);

    this.calculatePosition();

    if (this.tableName) {
      this.unwrappedTextWidth = 0;
      return;
    }

    if (this.columnHeader) {
      return;
    }

    if (this.checkNumberClip()) {
      const clippedNumber = this.getClippedNumber(this.originalText, this.text, this.number);
      const processedText = this.processText(labelMeshes, clippedNumber);
      if (!processedText) return;

      this.chars = processedText.chars;
      this.textWidth = processedText.textWidth;
      this.textHeight = processedText.textHeight;
      this.horizontalAlignOffsets = processedText.horizontalAlignOffsets;
      this.lineWidths = processedText.lineWidths;

      this.calculatePosition();
    }
  };

  /** Calculates the text glyphs and positions */
  private processText = (labelMeshes: LabelMeshes, originalText: string) => {
    if (!this.visible) return;

    const data = this.cellsLabels.bitmapFonts[this.fontName];
    if (!data) throw new Error(`Expected BitmapFont ${this.fontName} to be defined in CellLabel.processText`);

    const pos = new Point();
    const chars = [];
    const lineWidths: number[] = [];
    const lineSpaces: number[] = [];
    const displayText = originalText.replace(/(?:\r\n|\r)/g, '\n') || '';
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
      let charData = data.chars[charCode];
      // if not a normal character and not an emoji character, then we don't render it
      if (!charData) {
        if (emojiCodePoints.includes(charCode)) {
          charData = {
            specialCodePoint: charCode,
            textureUid: 0,
            textureHeight: data.size,
            xAdvance: data.size,
            xOffset: 0,
            yOffset: data.size / 2,
            origWidth: data.size,
            kerning: {},
            uvs: new Float32Array([]), // just placeholder
            frame: { x: 0, y: 0, width: data.size, height: data.size },
          };
        } else {
          continue;
        }
      }

      const labelMeshId = labelMeshes.add(this.fontName, this.fontSize, charData.textureUid, !!this.tint);
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
      if (
        maxWidth !== undefined &&
        isFloatGreaterThan(pos.x, maxWidth / scale) &&
        isFloatLessThan(charData.xAdvance + this.letterSpacing, maxWidth / scale)
      ) {
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
      displayText,
      horizontalAlignOffsets,
      lineWidths,
    };
  };

  private getUnwrappedTextWidth = (text: string): number => {
    if (!text) return 0;
    const data = this.cellsLabels.bitmapFonts[this.fontName];
    if (!data) throw new Error(`Expected BitmapFont ${this.fontName} to be defined in CellLabel.getUnwrappedTextWidth`);

    const scale = this.fontSize / data.size;

    const charsInput = splitTextToCharacters(text);
    let prevCharCode = null;
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
    let unwrappedTextWidth = (maxUnwrappedTextWidth + 3 * CELL_TEXT_MARGIN_LEFT) * scale;
    if (this.columnHeader) {
      unwrappedTextWidth += SORT_BUTTON_RADIUS * 2 + SORT_BUTTON_PADDING;
    }
    return unwrappedTextWidth;
  };

  // This attempts to reduce the decimal precision to ensure the number fits
  // within the cell. If it doesn't, it shows the pounds
  private getClippedNumber = (originalText: string, text: string, number: JsNumber | undefined): string => {
    if (number === undefined) return text;

    let digits: number | undefined = undefined;
    let infinityProtection = 0;
    let textWidth = this.getUnwrappedTextWidth(text);
    do {
      const result = reduceDecimals(originalText, text, number, digits);
      // we cannot reduce decimals anymore, so we show pound characters
      if (!result) {
        return this.getPoundText();
      }

      digits = result.currentFractionDigits - 1;
      text = result.number;
      textWidth = this.getUnwrappedTextWidth(text);
    } while (textWidth > this.AABB.width && digits >= 0 && infinityProtection++ < 1000);

    // we were not able to reduce the number to fit the cell, so we show pound characters
    if (digits < 0) {
      return this.getPoundText();
    }

    return text.toUpperCase();
  };

  private getPoundText = () => {
    const data = this.cellsLabels.bitmapFonts[this.fontName];
    if (!data) throw new Error(`Expected BitmapFont ${this.fontName} to be defined in CellLabel.getPoundText`);

    const scale = this.fontSize / data.size;
    const charCode = extractCharCode('#');
    const charData = data.chars[charCode];
    const charWidth = Math.max(charData.xAdvance, charData.frame.width) * scale + this.letterSpacing;
    const count = Math.floor((this.AABB.width - CELL_TEXT_MARGIN_LEFT * 3) / charWidth);
    const text = '#'.repeat(count);
    return text;
  };

  /** Adds the glyphs to the CellsLabels */
  updateLabelMesh = (labelMeshes: LabelMeshes): Bounds | undefined => {
    if (!this.visible) return;
    if (this.columnHeader) return;

    const data = this.cellsLabels.bitmapFonts[this.fontName];
    if (!data) throw new Error('Expected BitmapFont to be defined in CellLabel.updateLabelMesh');

    const scale = this.fontSize / data.size;
    const color = this.tint ? convertTintToArray(this.tint) : undefined;

    const bounds = new Bounds();
    const clipLeft = Math.max(this.cellClipLeft ?? -Infinity, this.AABB.right - (this.nextLeftWidth ?? Infinity));
    const clipRight = Math.min(this.cellClipRight ?? Infinity, this.AABB.left + (this.nextRightWidth ?? Infinity));
    const clipTop = this.cellClipTop ?? -Infinity;
    const clipBottom = this.cellClipBottom ?? Infinity;

    let textLeft = Infinity;
    let textRight = -Infinity;
    let textTop = Infinity;
    let textBottom = -Infinity;

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

      const charLeft = xPos;
      const charRight = xPos + textureFrame.width * scale;
      const charTop = yPos;
      const charBottom = yPos + textureFrame.height * scale;

      // remove letters that are outside the clipping bounds
      if (charLeft <= clipLeft || charRight >= clipRight || charTop <= clipTop || charBottom >= clipBottom) {
        // this removes extra characters from the mesh after a clip
        buffer.reduceSize(6);

        // update line width to the actual width of the text rendered after the clip
        this.lineWidths[char.line] = Math.min(this.lineWidths[char.line], char.position.x);
      } else if (char.charData.specialCodePoint !== undefined) {
        this.emojis.push({
          x: charLeft + (charRight - charLeft) / 2,
          y: charTop + (charBottom - charTop) / 2,
          codePoint: char.charData.specialCodePoint,
          width: char.charData.frame.width,
          height: char.charData.frame.height,
        });
      } else {
        textLeft = Math.min(textLeft, charLeft);
        textRight = Math.max(textRight, charRight);
        textTop = Math.min(textTop, charTop);
        textBottom = Math.max(textBottom, charBottom);
        this.insertBuffers({ buffer, bounds, xPos, yPos, textureFrame, textureUvs, scale, color });
      }
    }

    this.textLeft = textLeft;
    this.textRight = textRight;
    this.textTop = textTop;
    this.textBottom = textBottom;

    this.horizontalLines = [];

    if (this.underline) {
      this.addLine(UNDERLINE_OFFSET, clipLeft, clipRight, clipTop, clipBottom, scale);
    }

    if (this.strikeThrough) {
      this.addLine(STRIKE_THROUGH_OFFSET, clipLeft, clipRight, clipTop, clipBottom, scale);
    }

    return bounds;
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

  private addLine = (
    yOffset: number,
    clipLeft: number,
    clipRight: number,
    clipTop: number,
    clipBottom: number,
    scale: number
  ) => {
    let maxHeight = 0;
    this.lineWidths.forEach((lineWidth, line) => {
      const height = LINE_HEIGHT * line + yOffset * scale;
      const yPos = this.position.y + height + OPEN_SANS_FIX.y;
      if (yPos < clipTop || yPos + HORIZONTAL_LINE_THICKNESS > clipBottom) return;

      let horizontalOffset = this.horizontalAlignOffsets[line];
      if (this.roundPixels) horizontalOffset = Math.round(horizontalOffset);
      const xPos = Math.max(this.position.x + horizontalOffset * scale + OPEN_SANS_FIX.x, clipLeft);
      const width = Math.min(lineWidth * scale, clipRight - xPos);

      const rect = new Rectangle(xPos, yPos, width, HORIZONTAL_LINE_THICKNESS);
      this.horizontalLines.push(rect);
      maxHeight = Math.max(maxHeight, height + HORIZONTAL_LINE_THICKNESS);
    });
    this.textHeight = Math.max(this.textHeight, maxHeight);
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
    this.AABB.width = Math.max(this.AABB.width - delta, MIN_CELL_WIDTH);
    if (negativeX) {
      this.AABB.x += delta;
    }
    this.calculatePosition();
  };

  adjustHeight = (delta: number, negativeY: boolean): void => {
    this.AABB.height = Math.max(this.AABB.height - delta, CELL_HEIGHT);
    if (negativeY) {
      this.AABB.y += delta;
    }
    this.calculatePosition();
  };
}
