/**
 * A CellLabel contains the data necessary to render an individual cell within the Grid.
 * It is never rendered but instead populates LabelMeshes that are rendered.
 *
 * The CellLabel is responsible for calculating the position and style of each glyph within the
 * cell's text. It is also responsible for tracking any overflow of the cell's text. It also
 * populates the buffers for the relevant LabelMeshes based on this data.
 */

import { Bounds } from '@/app/grid/sheet/Bounds';
import { DROPDOWN_PADDING, DROPDOWN_SIZE } from '@/app/gridGL/cells/cellsLabel/drawSpecialConstants';
import {
  EMOJI_ADVANCE_RATIO,
  EMOJI_X_OFFSET_RATIO,
  EMOJI_Y_OFFSET_RATIO,
} from '@/app/gridGL/pixiApp/emojis/emojiConstants';
import { emojiStrings } from '@/app/gridGL/pixiApp/emojis/emojiMap';
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
  DEFAULT_FONT_SIZE,
  MIN_CELL_WIDTH,
  SORT_BUTTON_PADDING,
  SORT_BUTTON_RADIUS,
} from '@/shared/constants/gridConstants';
import { removeItems } from '@pixi/utils';
import { Point, Rectangle } from 'pixi.js';

interface CharRenderData {
  charData: RenderBitmapChar;
  labelMeshId: string;
  fontName: string;
  line: number;
  charCode: number;
  position: Point;
  prevSpaces: number;
}

/** Format span with character range and style overrides (from JsRenderCellFormatSpan). */
interface FormatSpan {
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikeThrough?: boolean;
  textColor?: string;
  link?: string;
}

/** Effective formatting for a character, merging cell defaults with span overrides. */
interface CharFormatting {
  fontName: string;
  textColor: number | undefined;
  underline: boolean;
  strikeThrough: boolean;
  isLink: boolean;
}

// Maximum number of characters to render per cell
const MAX_CHAR_LENGTH = 1000;

// magic numbers to make the WebGL rendering of OpenSans look similar to the HTML version
export const OPEN_SANS_FIX = { x: 1.8, y: -1.8 };

const SPILL_ERROR_TEXT = ' #SPILL';
const DEFAULT_ERROR_TEXT = ' #ERROR';

// values based on line position and thickness in monaco editor
const HORIZONTAL_LINE_THICKNESS = 1;
const UNDERLINE_OFFSET = 52;
const STRIKE_THROUGH_OFFSET = 32;

// Minimum vertical padding from cell edges before vertical alignment takes effect.
// For cells without enough space (like default height), text is centered instead.
const CELL_VERTICAL_PADDING = 2.5;

// todo: This does not implement RTL overlap clipping or more than 1 cell clipping

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
  private lineHeight: number;
  private underlineOffset: number;
  private strikeThroughOffset: number;
  tint: number;
  private maxWidth?: number;
  private roundPixels?: boolean;
  location: JsCoordinate;
  AABB: Rectangle;

  // Column/row bounds for the cell (for merged cells, this is the full extent)
  // For regular cells: minCol=x, maxCol=x, minRow=y, maxRow=y
  // For merged cells: minCol=x, maxCol=x+w-1, minRow=y, maxRow=y+h-1
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;

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
  /** Horizontal lines for underline/strikethrough with their tint colors. */
  horizontalLines: { rect: Rectangle; tint: number }[] = [];

  private align: CellAlign | 'justify';
  private verticalAlign: CellVerticalAlign;
  private wrap: CellWrap;

  private letterSpacing: number;
  private bold: boolean;
  private italic: boolean;

  link: boolean;
  /** True if this is a naked URL (plain text auto-detected as URL, not a RichText hyperlink). */
  isNakedUrl: boolean;
  /** Link spans with character ranges and URLs (for RichText hyperlinks). */
  linkSpans: Array<{ start: number; end: number; url: string }>;
  /** Format spans with character ranges and style overrides (from RichText). */
  private formatSpans: FormatSpan[];
  /** Calculated link rectangles with URLs (populated after updateLabelMesh). */
  linkRectangles: Array<{
    rect: Rectangle;
    url: string;
    underlineY: number;
    linkText: string;
    isNakedUrl?: boolean;
    spanStart: number;
    spanEnd: number;
  }>;
  private underline: boolean;
  private strikeThrough: boolean;

  private textWidth = 0;
  textHeight = CELL_HEIGHT;
  unwrappedTextWidth = CELL_WIDTH;

  // Tracks actual glyph height which may exceed textHeight for descenders (g, p, y, etc.)
  // Initialize to LINE_HEIGHT (not CELL_HEIGHT) so that if updateText is never called,
  // textHeightWithDescenders will equal CELL_HEIGHT (LINE_HEIGHT + CELL_VERTICAL_PADDING * 2)
  private glyphHeight = LINE_HEIGHT;

  // Returns the height needed for row sizing to ensure text isn't clipped.
  // Uses actual glyph height (including descenders) plus vertical padding.
  get textHeightWithDescenders(): number {
    // Include constant vertical padding (top and bottom) - not scaled with font size.
    // Round to avoid floating point precision issues in height comparisons.
    return Math.round(this.glyphHeight + CELL_VERTICAL_PADDING * 2);
  }

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
  specialType?: 'Checkbox' | 'List';
  checkboxValue?: boolean;

  private getText = (cell: JsRenderCell) => {
    let text = '';
    switch (cell?.special) {
      case 'SpillError':
        text = SPILL_ERROR_TEXT;
        break;
      case 'RunError':
        // Use the specific error text if available (e.g., "#N/A", "#DIV/0!")
        text = cell.errorText ? ` ${cell.errorText}` : DEFAULT_ERROR_TEXT;
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

  constructor(
    cellsLabels: CellsLabels,
    cell: JsRenderCell,
    screenRectangle: Rectangle,
    minCol: number,
    maxCol: number,
    minRow: number,
    maxRow: number
  ) {
    this.cellsLabels = cellsLabels;
    this.originalText = cell.value;
    this.text = this.getText(cell);
    this.linkSpans = [];
    this.formatSpans = [];
    this.linkRectangles = [];
    this.isNakedUrl = false;
    this.link = this.isLink(cell);
    this.initFormatSpans(cell);
    this.fontSize = cell.fontSize ?? DEFAULT_FONT_SIZE;
    this.lineHeight = (this.fontSize / DEFAULT_FONT_SIZE) * LINE_HEIGHT;
    this.underlineOffset = UNDERLINE_OFFSET;
    this.strikeThroughOffset = STRIKE_THROUGH_OFFSET;
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

    // Store column/row bounds
    this.minCol = minCol;
    this.maxCol = maxCol;
    this.minRow = minRow;
    this.maxRow = maxRow;

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
    this.verticalAlign = cell.verticalAlign ?? 'bottom';
    this.wrap = cell.wrap === undefined && this.isNumber() ? 'clip' : (cell.wrap ?? 'overflow');
    this.underline = cell.underline ?? this.link;
    this.strikeThrough = !!cell.strikeThrough;
    this.tableName = !!cell.tableName;
    this.columnHeader = !!cell.columnHeader;
    this.specialType = cell.special === 'Checkbox' || cell.special === 'List' ? cell.special : undefined;
    this.checkboxValue = cell.special === 'Checkbox' ? cell.value === 'true' : undefined;
    this.updateCellLimits();
  }

  private updateFontName = () => {
    const bold = this.bold ? 'Bold' : '';
    const italic = this.italic ? 'Italic' : '';
    this.fontName = `OpenSans${bold || italic ? '-' : ''}${bold}${italic}`;
  };

  /** Initialize format spans from cell data. */
  private initFormatSpans = (cell: JsRenderCell) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formatSpans = (cell as any).formatSpans as FormatSpan[] | undefined;
    if (formatSpans && formatSpans.length > 0) {
      this.formatSpans = formatSpans;
    }
  };

  /** Check if this cell has any format spans (requiring per-character rendering). */
  private hasFormatSpans = (): boolean => {
    return this.formatSpans.length > 0;
  };

  /** Get the font name for a character based on its span formatting. */
  private getFontNameForChar = (charIndex: number): string => {
    // Start with cell defaults
    let bold = this.bold;
    let italic = this.italic;

    // Find span containing this character and override
    for (const span of this.formatSpans) {
      if (charIndex >= span.start && charIndex < span.end) {
        if (span.bold !== undefined) bold = span.bold;
        if (span.italic !== undefined) italic = span.italic;
        break; // Spans don't overlap
      }
    }

    const boldStr = bold ? 'Bold' : '';
    const italicStr = italic ? 'Italic' : '';
    return `OpenSans${boldStr || italicStr ? '-' : ''}${boldStr}${italicStr}`;
  };

  /** Get the effective formatting for a character, merging cell defaults with span overrides. */
  private getCharFormatting = (charIndex: number): CharFormatting => {
    // Start with cell defaults
    let bold = this.bold;
    let italic = this.italic;
    let underline = this.underline;
    let strikeThrough = this.strikeThrough;
    let textColor: number | undefined = this.tint || undefined;
    let isLink = this.link;

    // Find span containing this character and override
    for (const span of this.formatSpans) {
      if (charIndex >= span.start && charIndex < span.end) {
        if (span.bold !== undefined) bold = span.bold;
        if (span.italic !== undefined) italic = span.italic;
        if (span.underline !== undefined) underline = span.underline;
        if (span.strikeThrough !== undefined) strikeThrough = span.strikeThrough;
        if (span.textColor !== undefined) textColor = convertColorStringToTint(span.textColor);
        if (span.link !== undefined) isLink = true;
        break; // Spans don't overlap
      }
    }

    const boldStr = bold ? 'Bold' : '';
    const italicStr = italic ? 'Italic' : '';
    const fontName = `OpenSans${boldStr || italicStr ? '-' : ''}${boldStr}${italicStr}`;

    return { fontName, textColor, underline, strikeThrough, isLink };
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
    // Check for RichText hyperlink spans from Rust
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const linkSpans = (cell as any).linkSpans as Array<{ start: number; end: number; url: string }> | undefined;
    if (linkSpans && linkSpans.length > 0) {
      this.linkSpans = linkSpans;
      // Only return true (style entire cell as link) if the link spans cover the entire text
      // For partial hyperlinks, return false so only the span portions get link styling
      const coversEntireText =
        linkSpans.length === 1 && linkSpans[0].start === 0 && linkSpans[0].end >= cell.value.length;
      return coversEntireText;
    }
    // Check for naked URL in cell value
    if (cell.number !== undefined || cell.special !== undefined) return false;
    if (!URL_REGEX.test(cell.value)) return false;
    try {
      new URL(cell.value);
      // Treat entire text as a single link span
      this.linkSpans = [{ start: 0, end: cell.value.length, url: cell.value }];
      this.isNakedUrl = true;
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

    // Calculate available space for vertical positioning
    // Use glyphHeight when it's larger than textHeight (e.g., for emojis with baseline offset)
    // to ensure the content fits within the cell
    const effectiveTextHeight = Math.max(this.textHeight, this.glyphHeight);
    const availableSpace = this.AABB.height - effectiveTextHeight;

    // The default extra space in a cell (constant regardless of font size).
    // When cells auto-grow with font size, they maintain this same extra space.
    const defaultExtraSpace = CELL_HEIGHT - LINE_HEIGHT;

    // If available space is at or below the default extra space, center the text.
    // This matches behavior in other spreadsheets for default-height cells.
    if (availableSpace <= defaultExtraSpace) {
      const actualTop = this.AABB.top + Math.max(0, availableSpace / 2);
      this.position.y = actualTop;
      this.actualTop = actualTop;
    } else {
      // Apply vertical alignment with constant padding from edges
      if (this.verticalAlign === 'bottom') {
        const actualTop = this.AABB.bottom - effectiveTextHeight - CELL_VERTICAL_PADDING;
        this.position.y = actualTop;
        this.actualTop = actualTop;
      } else if (this.verticalAlign === 'middle') {
        const actualTop = this.AABB.top + availableSpace / 2;
        this.position.y = actualTop;
        this.actualTop = actualTop;
      } else {
        // 'top' alignment
        const actualTop = this.AABB.top + CELL_VERTICAL_PADDING;
        this.position.y = actualTop;
        this.actualTop = actualTop;
      }
    }
    this.actualBottom = Math.min(this.AABB.bottom, this.position.y + effectiveTextHeight);
  };

  updateText = (labelMeshes: LabelMeshes): void => {
    if (!this.visible) return;

    // Recalculate cell limits (including maxWidth for wrapping) in case AABB changed
    this.updateCellLimits();

    let processedText = this.processText(labelMeshes, this.text);
    if (!processedText) return;

    this.chars = processedText.chars;
    this.textWidth = processedText.textWidth;
    this.textHeight = processedText.textHeight;
    this.glyphHeight = processedText.glyphHeight;
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
      this.glyphHeight = processedText.glyphHeight;
      this.horizontalAlignOffsets = processedText.horizontalAlignOffsets;
      this.lineWidths = processedText.lineWidths;

      this.calculatePosition();
    }

    // Pre-add dot mesh buffers if the dot is on a different texture than existing chars
    // This ensures buffers are allocated during prepare()
    if (this.text.trim() !== '' && this.chars.length > 0) {
      const data = this.cellsLabels.bitmapFonts[this.fontName];
      if (data) {
        const dotCharCode = extractCharCode('·');
        const dotCharData = data.chars[dotCharCode];
        if (dotCharData) {
          // Check if dot is on a different texture than the first character
          const needsSeparateMesh = this.chars[0].charData.textureUid !== dotCharData.textureUid;
          if (needsSeparateMesh) {
            // Add one dot mesh entry per character so we have enough buffers
            const needsColor = !!this.tint || (!this.link && this.linkSpans.length > 0) || this.hasFormatSpans();
            for (let i = 0; i < this.chars.length; i++) {
              labelMeshes.add(this.fontName, this.fontSize, dotCharData.textureUid, needsColor);
            }
          }
        }
      }
    }
  };

  /** Calculates the text glyphs and positions */
  private processText = (labelMeshes: LabelMeshes, originalText: string) => {
    if (!this.visible) return;

    // Use base font for scale calculation (font size is constant across cell)
    const baseData = this.cellsLabels.bitmapFonts[this.fontName];
    if (!baseData) throw new Error(`Expected BitmapFont ${this.fontName} to be defined in CellLabel.processText`);

    const pos = new Point();
    const chars = [];
    const lineWidths: number[] = [];
    const lineSpaces: number[] = [];
    const displayText = originalText.replace(/(?:\r\n|\r)/g, '\n') || '';
    const charsInput = splitTextToCharacters(displayText);
    const scale = this.fontSize / baseData.size;
    const maxWidth = this.maxWidth;
    let prevCharCode = null;
    let lastLineWidth = 0;
    let maxLineWidth = 0;
    let line = 0;
    let lastBreakPos = -1;
    let lastBreakWidth = 0;
    let spacesRemoved = 0;
    let spaceCount = 0;
    let i: number;

    // Check if we need per-character font selection
    const hasFormatSpans = this.hasFormatSpans();

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
        pos.y += this.lineHeight / scale; // data.lineHeight;
        prevCharCode = null;
        spaceCount = 0;
        continue;
      }

      // Get the font for this character based on its span formatting
      const charFontName = hasFormatSpans ? this.getFontNameForChar(i) : this.fontName;
      const fontData = this.cellsLabels.bitmapFonts[charFontName];
      if (!fontData) throw new Error(`Expected BitmapFont ${charFontName} to be defined in CellLabel.processText`);

      let charData = fontData.chars[charCode];
      // if not a normal character and not an emoji character, then we don't render it
      if (!charData) {
        // Check if this is a known emoji (including multi-codepoint emojis with variation selectors)
        let isEmoji = emojiStrings.has(char);
        let emojiToRender = char;
        let skipNextChar = false;

        // If not found, try adding variation selector-16 (common for colored emojis)
        // This handles cases where Array.from() splits ❤️ into ['❤', '️']
        if (!isEmoji && char.length === 1) {
          const nextChar = i + 1 < charsInput.length ? charsInput[i + 1] : '';
          const withVariationSelector = char + '\uFE0F';

          // Check if next char is a variation selector and the combo is a known emoji
          if (nextChar === '\uFE0F' && emojiStrings.has(withVariationSelector)) {
            isEmoji = true;
            emojiToRender = withVariationSelector;
            skipNextChar = true; // Skip the variation selector in the next iteration
          } else if (emojiStrings.has(withVariationSelector)) {
            // Sometimes the variation selector might not be split as a separate char
            isEmoji = true;
            emojiToRender = withVariationSelector;
          }
        }

        if (isEmoji) {
          const emojiSize = this.lineHeight / scale;
          const emojiAdvance = emojiSize * EMOJI_ADVANCE_RATIO;
          // Offsets to align emoji with inline editor positioning
          const xOffset = emojiSize * EMOJI_X_OFFSET_RATIO;
          const yOffset = baseData.lineHeight * EMOJI_Y_OFFSET_RATIO;
          charData = {
            specialEmoji: emojiToRender,
            textureUid: 0,
            textureHeight: emojiSize,
            xAdvance: emojiAdvance,
            xOffset,
            yOffset,
            origWidth: emojiSize,
            kerning: {},
            uvs: new Float32Array([]), // just placeholder
            frame: { x: 0, y: 0, width: emojiSize, height: emojiSize },
          };

          // Skip the next character if we consumed it as part of this emoji
          if (skipNextChar) {
            i++;
            spacesRemoved++;
          }
        }

        if (!charData) {
          continue;
        }
      }

      // Need color support if we have a tint OR if we have partial hyperlinks OR if we have format spans
      const needsColor = !!this.tint || (!this.link && this.linkSpans.length > 0) || hasFormatSpans;
      const labelMeshId = labelMeshes.add(charFontName, this.fontSize, charData.textureUid, needsColor);
      if (prevCharCode && charData.kerning[prevCharCode]) {
        pos.x += charData.kerning[prevCharCode];
      }
      const charRenderData: CharRenderData = {
        labelMeshId,
        fontName: charFontName,
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
        pos.y += this.lineHeight / scale; //data.lineHeight;
        prevCharCode = null;
        spaceCount = 0;
      } else {
        lastLineWidth = charRenderData.position.x + Math.max(charData.xAdvance, charData.frame.width);
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

    // Use lineHeight for text height (ensures consistent alignment across cells)
    const calculatedTextHeight = this.lineHeight * (line + 1);

    // Calculate actual glyph height separately (for row sizing to prevent clipping)
    // This accounts for descenders (g, p, y) that extend below the baseline.
    // We only count the portion that extends beyond the font's native line height
    // as a "descender" - characters that fit within the font's line height should
    // not cause row resizing.
    let calculatedGlyphHeight = calculatedTextHeight;
    if (chars.length > 0) {
      let maxDescenderExtension = 0;
      const fontLineHeight = baseData.lineHeight; // Font's native line height
      for (const char of chars) {
        const charBottom = char.position.y + char.charData.frame.height;
        // For multi-line text, compare against the expected bottom for this line
        const expectedLineBottom = (char.line + 1) * fontLineHeight;
        const descenderExtension = Math.max(0, charBottom - expectedLineBottom);
        maxDescenderExtension = Math.max(maxDescenderExtension, descenderExtension);
      }
      // Add scaled descender extension to our calculated text height
      calculatedGlyphHeight = calculatedTextHeight + maxDescenderExtension * scale;
    }

    // Note: Underlines are purely decorative and should NOT affect text height or
    // glyph height. This matches Excel/Google Sheets behavior where adding underline
    // doesn't change cell height or text positioning. The underline is drawn at a
    // fixed offset below the text baseline within the existing cell bounds.

    return {
      chars,
      textWidth: maxLineWidth * scale + OPEN_SANS_FIX.x * 2,
      textHeight: calculatedTextHeight,
      glyphHeight: calculatedGlyphHeight,
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
    // Emoji size uses lineHeight (matching processText)
    const emojiSize = this.lineHeight / scale;
    const emojiAdvance = emojiSize * EMOJI_ADVANCE_RATIO;

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
      let charData = data.chars[charCode];

      // Handle emojis that don't have charData in the bitmap font
      if (!charData) {
        let isEmoji = emojiStrings.has(char);
        let skipNextChar = false;

        // Check for variation selector combinations
        if (!isEmoji && char.length === 1) {
          const nextChar = i + 1 < charsInput.length ? charsInput[i + 1] : '';
          const withVariationSelector = char + '\uFE0F';

          if (nextChar === '\uFE0F' && emojiStrings.has(withVariationSelector)) {
            isEmoji = true;
            skipNextChar = true;
          } else if (emojiStrings.has(withVariationSelector)) {
            isEmoji = true;
          }
        }

        if (isEmoji) {
          // Use emojiAdvance for width (matching processText and font metrics)
          curUnwrappedTextWidth += emojiAdvance + this.letterSpacing;
          maxUnwrappedTextWidth = Math.max(maxUnwrappedTextWidth, curUnwrappedTextWidth);
          prevCharCode = null;

          if (skipNextChar) {
            i++;
          }
        }
        continue;
      }

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
    const count = Math.max(0, Math.floor((this.AABB.width - CELL_TEXT_MARGIN_LEFT * 3) / charWidth));
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
    // Scale the OPEN_SANS_FIX adjustments with font size to maintain proper centering
    const fontScale = this.fontSize / DEFAULT_FONT_SIZE;
    const scaledFixY = OPEN_SANS_FIX.y * fontScale;
    const hasPartialLinks = !this.link && this.linkSpans.length > 0;
    const hasFormatSpans = this.hasFormatSpans();
    // For partial hyperlinks or format spans, we need a default color for non-styled text
    // because the buffer is created with color support
    const needsDefaultColor = hasPartialLinks || hasFormatSpans;
    const defaultTextColor = needsDefaultColor ? convertTintToArray(colors.cellFontColor) : undefined;
    const color = this.tint ? convertTintToArray(this.tint) : defaultTextColor;
    // Pre-calculate link color for partial hyperlinks
    const linkColor = hasPartialLinks ? convertTintToArray(convertColorStringToTint(colors.link)) : undefined;

    // Clear emojis array to prevent accumulation on re-renders
    this.emojis = [];

    const bounds = new Bounds();
    const clipLeft = Math.max(this.cellClipLeft ?? -Infinity, this.AABB.right - (this.nextLeftWidth ?? Infinity));
    const clipRight = Math.min(this.cellClipRight ?? Infinity, this.AABB.left + (this.nextRightWidth ?? Infinity));
    const clipTop = this.cellClipTop ?? -Infinity;
    const clipBottom = this.cellClipBottom ?? Infinity;

    let textLeft = Infinity;
    let textRight = -Infinity;
    let textTop = Infinity;
    let textBottom = -Infinity;

    // Check which lines are vertically clipped beyond the cell bounds
    // We check against lineHeight-based bounds (not actual glyph extents) because:
    // 1. Text is positioned based on lineHeight for consistent alignment
    // 2. Descenders naturally extend slightly beyond lineHeight - this is expected
    // 3. Only show dots when the line itself doesn't fit, not for descender overflow
    const CLIP_EPSILON = 0.5;

    // Descenders (p, q, g, y, j, etc.) extend below the baseline. At larger font sizes,
    // they extend more pixels, so we need a scaled epsilon for vertical glyph clipping.
    // Base value of 3 pixels at DEFAULT_FONT_SIZE (14), scaling up with font size.
    const DESCENDER_CLIP_EPSILON = Math.max(0.5, fontScale * 3);

    // Italic characters can extend slightly to the left of their logical position due to slant.
    // Allow a small tolerance on the left side to prevent clipping italic glyphs at the boundary.
    // Base value of 3 pixels at DEFAULT_FONT_SIZE (14), scaling with font size.
    const ITALIC_CLIP_EPSILON = Math.max(0.5, fontScale * 3);
    const clippedLines = new Set<number>();
    const maxLine = this.chars.length > 0 ? Math.max(...this.chars.map((c) => c.line)) : 0;
    for (let line = 0; line <= maxLine; line++) {
      // Calculate the line's vertical bounds based on lineHeight (consistent with positioning)
      const lineTop = this.position.y + line * this.lineHeight;
      const lineBottom = lineTop + this.lineHeight;

      // Check if the line (based on lineHeight) extends beyond the cell bounds
      if (lineTop < this.AABB.top - CLIP_EPSILON || lineBottom > this.AABB.bottom + CLIP_EPSILON) {
        clippedLines.add(line);
      }
    }

    const hasVerticalClipping = clippedLines.size > 0;

    // Get dot character data for rendering clipped lines
    const dotCharCode = extractCharCode('·');
    const dotCharData = data.chars[dotCharCode];

    // Group characters by line for dot rendering of clipped lines
    const charsByLine = new Map<number, CharRenderData[]>();
    for (const char of this.chars) {
      if (!charsByLine.has(char.line)) {
        charsByLine.set(char.line, []);
      }
      charsByLine.get(char.line)!.push(char);
    }

    for (let i = 0; i < this.chars.length; i++) {
      const char = this.chars[i];
      const isLineClipped = clippedLines.has(char.line);

      if (isLineClipped && dotCharData) {
        // This line is clipped - render dots instead of characters
        const lineChars = charsByLine.get(char.line)!;
        const charIndexInLine = lineChars.indexOf(char);

        // Calculate the center positions of the first and last characters
        const firstChar = lineChars[0];
        const lastChar = lineChars[lineChars.length - 1];

        const firstHorizontalOffset =
          firstChar.position.x +
          this.horizontalAlignOffsets[firstChar.line] * (this.align === 'justify' ? firstChar.prevSpaces : 1);
        const firstCharXPos = this.position.x + firstHorizontalOffset * scale + OPEN_SANS_FIX.x;
        const firstCharCenterX = firstCharXPos + (firstChar.charData.frame.width * scale) / 2;

        const lastHorizontalOffset =
          lastChar.position.x +
          this.horizontalAlignOffsets[lastChar.line] * (this.align === 'justify' ? lastChar.prevSpaces : 1);
        const lastCharXPos = this.position.x + lastHorizontalOffset * scale + OPEN_SANS_FIX.x;
        const lastCharCenterX = lastCharXPos + (lastChar.charData.frame.width * scale) / 2;

        // Evenly space dots between first and last character centers
        const totalWidth = lastCharCenterX - firstCharCenterX;
        const spacing = lineChars.length > 1 ? totalWidth / (lineChars.length - 1) : 0;
        const dotCenterX = firstCharCenterX + charIndexInLine * spacing;
        const dotWidth = dotCharData.frame.width * scale;
        const xPos = dotCenterX - dotWidth / 2;

        // Position the dot vertically centered on where the line would have been rendered
        // Calculate the vertical bounds of the line from its characters
        let lineMinY = Infinity;
        let lineMaxY = -Infinity;
        for (const lineChar of lineChars) {
          const charYPos = this.position.y + lineChar.position.y * scale;
          const charHeight = lineChar.charData.frame.height * scale;
          lineMinY = Math.min(lineMinY, charYPos);
          lineMaxY = Math.max(lineMaxY, charYPos + charHeight);
        }
        const lineCenterY = (lineMinY + lineMaxY) / 2;
        const dotHeight = dotCharData.frame.height * scale;
        const yPos = lineCenterY - dotHeight / 2 + scaledFixY;

        // Check if dot needs a separate mesh (different texture page)
        const needsSeparateMesh = char.charData.textureUid !== dotCharData.textureUid;

        let labelMesh, buffer;
        if (needsSeparateMesh) {
          // First, remove the original character from its buffer
          const originalLabelMesh = labelMeshes.get(char.labelMeshId);
          const originalBuffer = originalLabelMesh.getBuffer();
          originalBuffer.reduceSize(6);

          // Use the separate dot mesh
          // Must match the needsColor calculation in updateText() to ensure we use the pre-allocated mesh
          const needsColorForDot = !!this.tint || (!this.link && this.linkSpans.length > 0) || hasFormatSpans;
          const dotLabelMeshId = labelMeshes.add(
            this.fontName,
            this.fontSize,
            dotCharData.textureUid,
            needsColorForDot
          );
          labelMesh = labelMeshes.get(dotLabelMeshId);
          buffer = labelMesh.getBuffer();
        } else {
          // Reuse the original character's buffer, just change texture/UVs
          labelMesh = labelMeshes.get(char.labelMeshId);
          buffer = labelMesh.getBuffer();
        }

        const textureFrame = dotCharData.frame;
        const textureUvs = dotCharData.uvs;

        const charLeft = xPos;
        const charRight = xPos + textureFrame.width * scale;
        const charTop = yPos;
        const charBottom = yPos + textureFrame.height * scale;

        // Clip dots that are outside horizontal bounds or extend below the cell bottom
        const horizontallyClipped = charLeft <= clipLeft || charRight >= clipRight;
        const belowCellBottom = charBottom > this.AABB.bottom + DESCENDER_CLIP_EPSILON;
        if (horizontallyClipped || belowCellBottom) {
          buffer.reduceSize(6);
        } else {
          textLeft = Math.min(textLeft, charLeft);
          textRight = Math.max(textRight, charRight);
          textTop = Math.min(textTop, charTop);
          textBottom = Math.max(textBottom, charBottom);
          this.insertBuffers({ buffer, bounds, xPos, yPos, textureFrame, textureUvs, scale, color });
        }
      } else {
        // This line is NOT clipped - render normally
        // If we have dot data and need separate mesh, clean up unused dot buffer
        if (dotCharData && char.charData.textureUid !== dotCharData.textureUid) {
          const needsColorForCleanup = !!this.tint || (!this.link && this.linkSpans.length > 0) || hasFormatSpans;
          const dotLabelMeshId = labelMeshes.add(
            char.fontName,
            this.fontSize,
            dotCharData.textureUid,
            needsColorForCleanup
          );
          const dotLabelMesh = labelMeshes.get(dotLabelMeshId);
          try {
            const buffer = dotLabelMesh.getBuffer();
            buffer.reduceSize(6);
          } catch (e) {
            // Buffer might not exist, that's fine
          }
        }

        let horizontalOffset =
          char.position.x + this.horizontalAlignOffsets[char.line] * (this.align === 'justify' ? char.prevSpaces : 1);
        if (this.roundPixels) {
          horizontalOffset = Math.round(horizontalOffset);
        }
        const xPos = this.position.x + horizontalOffset * scale + OPEN_SANS_FIX.x;
        const yPos = this.position.y + char.position.y * scale + scaledFixY;
        const labelMesh = labelMeshes.get(char.labelMeshId);
        const textureFrame = char.charData.frame;
        const textureUvs = char.charData.uvs;
        const buffer = labelMesh.getBuffer();

        const charLeft = xPos;
        const charRight = xPos + textureFrame.width * scale;
        const charTop = yPos;
        const charBottom = yPos + textureFrame.height * scale;

        // remove letters that are outside the clipping bounds
        // Use strict inequality with small tolerance for vertical clipping to avoid
        // floating point issues that could cause emojis to oscillate between visible and clipped
        // Use DESCENDER_CLIP_EPSILON for bottom clipping to allow for descenders (p, q, g, y, j)
        // Use ITALIC_CLIP_EPSILON for left clipping to allow for italic character slant
        const verticallyClipped = charTop < clipTop - CLIP_EPSILON || charBottom > clipBottom + DESCENDER_CLIP_EPSILON;
        const horizontallyClipped = charLeft < clipLeft - ITALIC_CLIP_EPSILON || charRight >= clipRight;

        // Don't clip emojis vertically. The row will resize based on textHeightWithDescenders,
        // but AABB is set before that calculation completes. Skipping vertical clipping for
        // emojis prevents them from flickering between visible and clipped during resize.
        const isEmoji = char.charData.specialEmoji !== undefined;
        const shouldClip = isEmoji ? horizontallyClipped : horizontallyClipped || verticallyClipped;

        if (shouldClip) {
          // this removes extra characters from the mesh after a clip
          buffer.reduceSize(6);

          // update line width to the actual width of the text rendered after the clip
          this.lineWidths[char.line] = Math.min(this.lineWidths[char.line], char.position.x);
        } else if (char.charData.specialEmoji !== undefined) {
          // Store the actual desired render size (lineHeight) directly
          this.emojis.push({
            x: charLeft + (charRight - charLeft) / 2,
            y: charTop + (charBottom - charTop) / 2,
            emoji: char.charData.specialEmoji,
            width: this.lineHeight,
            height: this.lineHeight,
          });
        } else {
          textLeft = Math.min(textLeft, charLeft);
          textRight = Math.max(textRight, charRight);
          textTop = Math.min(textTop, charTop);
          textBottom = Math.max(textBottom, charBottom);
          // Get color for this character based on its formatting
          let charColor = color;
          if (hasFormatSpans) {
            // Use format span color if available
            const formatting = this.getCharFormatting(i);
            if (formatting.isLink) {
              charColor = convertTintToArray(convertColorStringToTint(colors.link));
            } else if (formatting.textColor !== undefined) {
              charColor = convertTintToArray(formatting.textColor);
            }
          } else if (linkColor && this.isCharInLinkSpan(i)) {
            // Legacy: use link color for characters within link spans (partial hyperlinks)
            charColor = linkColor;
          }
          this.insertBuffers({ buffer, bounds, xPos, yPos, textureFrame, textureUvs, scale, color: charColor });
        }
      }
    }

    this.textLeft = textLeft;
    this.textRight = textRight;
    this.textTop = textTop;
    this.textBottom = textBottom;

    // Calculate link rectangles based on character positions, clipped to visible bounds
    this.calculateLinkRectangles(scale, clipLeft, clipRight, clipTop, clipBottom);

    this.horizontalLines = [];

    if (!hasVerticalClipping) {
      if (hasFormatSpans) {
        // Per-span underline/strikethrough
        this.addSpanLines(scale, scaledFixY, clipLeft, clipRight, clipTop, clipBottom);
      } else {
        // Cell-level underline/strikethrough
        if (this.underline) {
          this.addLine(this.underlineOffset, clipLeft, clipRight, clipTop, clipBottom, scale, scaledFixY);
        }
        if (this.strikeThrough) {
          this.addLine(this.strikeThroughOffset, clipLeft, clipRight, clipTop, clipBottom, scale, scaledFixY);
        }
      }
    }

    return bounds;
  };

  /** Calculate pixel rectangles for each link span based on character positions.
   * Clips rectangles to the provided bounds so hover detection only works on visible portions.
   */
  private calculateLinkRectangles = (
    scale: number,
    clipLeft: number,
    clipRight: number,
    clipTop: number,
    clipBottom: number
  ) => {
    this.linkRectangles = [];
    if (this.linkSpans.length === 0 || this.chars.length === 0) return;

    // Scale the OPEN_SANS_FIX adjustments with font size
    const fontScale = this.fontSize / DEFAULT_FONT_SIZE;
    const scaledFixY = OPEN_SANS_FIX.y * fontScale;

    for (const span of this.linkSpans) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      let spanLine = 0; // Track which line this span is on (for underline positioning)

      // Find characters within this span's range
      for (let i = 0; i < this.chars.length; i++) {
        if (i >= span.start && i < span.end) {
          const char = this.chars[i];
          spanLine = char.line; // Use the line of the last character in the span
          const horizontalOffset =
            char.position.x + this.horizontalAlignOffsets[char.line] * (this.align === 'justify' ? char.prevSpaces : 1);
          const xPos = this.position.x + horizontalOffset * scale + OPEN_SANS_FIX.x;
          const yPos = this.position.y + char.position.y * scale + scaledFixY;
          const charRight = xPos + char.charData.frame.width * scale;
          const charBottom = yPos + char.charData.frame.height * scale;

          minX = Math.min(minX, xPos);
          maxX = Math.max(maxX, charRight);
          minY = Math.min(minY, yPos);
          maxY = Math.max(maxY, charBottom);
        }
      }

      // If we found characters for this span, create a rectangle
      if (minX < Infinity) {
        // Clip the rectangle to the visible bounds
        const clippedMinX = Math.max(minX, clipLeft);
        const clippedMaxX = Math.min(maxX, clipRight);
        const clippedMinY = Math.max(minY, clipTop);
        const clippedMaxY = Math.min(maxY, clipBottom);

        // Skip this link if it's completely clipped
        if (clippedMinX >= clippedMaxX || clippedMinY >= clippedMaxY) {
          continue;
        }

        // Calculate underline y position using the same formula as addLine
        const underlineY = this.position.y + this.lineHeight * spanLine + this.underlineOffset * scale + scaledFixY;
        // Get the link text from the original text
        const linkText = this.originalText.slice(span.start, span.end);
        this.linkRectangles.push({
          rect: new Rectangle(clippedMinX, clippedMinY, clippedMaxX - clippedMinX, clippedMaxY - clippedMinY),
          url: span.url,
          underlineY,
          linkText,
          isNakedUrl: this.isNakedUrl,
          spanStart: span.start,
          spanEnd: span.end,
        });
      }
    }
  };

  /** Check if a character index is within any link span. */
  private isCharInLinkSpan = (charIndex: number): boolean => {
    for (const span of this.linkSpans) {
      if (charIndex >= span.start && charIndex < span.end) {
        return true;
      }
    }
    return false;
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
    scale: number,
    scaledFixY: number
  ) => {
    this.lineWidths.forEach((lineWidth, line) => {
      const height = this.lineHeight * line + yOffset * scale;
      const yPos = this.position.y + height + scaledFixY;
      if (yPos < clipTop || yPos + HORIZONTAL_LINE_THICKNESS > clipBottom) return;

      let horizontalOffset = this.horizontalAlignOffsets[line];
      if (this.roundPixels) horizontalOffset = Math.round(horizontalOffset);
      const xPos = Math.max(this.position.x + horizontalOffset * scale + OPEN_SANS_FIX.x, clipLeft);
      const width = Math.min(lineWidth * scale, clipRight - xPos);

      const rect = new Rectangle(xPos, yPos, width, HORIZONTAL_LINE_THICKNESS);
      this.horizontalLines.push({ rect, tint: this.tint });
    });
    // Note: We intentionally don't update textHeight here. Underlines/strikethroughs
    // are decorative and shouldn't affect text height for layout purposes.
  };

  /** Add underline/strikethrough lines for format spans (per-character formatting). */
  private addSpanLines = (
    scale: number,
    scaledFixY: number,
    clipLeft: number,
    clipRight: number,
    clipTop: number,
    clipBottom: number
  ) => {
    if (this.chars.length === 0) return;

    const baseData = this.cellsLabels.bitmapFonts[this.fontName];
    if (!baseData) return;

    // Track consecutive runs of underlined/strikethrough characters with same color
    interface LineRun {
      startCharIdx: number;
      endCharIdx: number;
      line: number;
      type: 'underline' | 'strikethrough';
      tint: number;
    }

    const runs: LineRun[] = [];
    let currentUnderlineStart: number | null = null;
    let currentUnderlineLine = 0;
    let currentUnderlineTint = 0;
    let currentStrikeStart: number | null = null;
    let currentStrikeLine = 0;
    let currentStrikeTint = 0;

    for (let i = 0; i <= this.chars.length; i++) {
      const formatting = i < this.chars.length ? this.getCharFormatting(i) : null;
      const charLine = i < this.chars.length ? this.chars[i].line : -1;
      // Use the text color from formatting, falling back to cell tint
      const charTint = formatting?.textColor ?? this.tint;

      // Handle underline runs - break on underline change, line change, or color change
      if (formatting?.underline && currentUnderlineStart === null) {
        currentUnderlineStart = i;
        currentUnderlineLine = charLine;
        currentUnderlineTint = charTint;
      } else if (
        currentUnderlineStart !== null &&
        (!formatting?.underline || charLine !== currentUnderlineLine || charTint !== currentUnderlineTint)
      ) {
        runs.push({
          startCharIdx: currentUnderlineStart,
          endCharIdx: i - 1,
          line: currentUnderlineLine,
          type: 'underline',
          tint: currentUnderlineTint,
        });
        if (formatting?.underline) {
          currentUnderlineStart = i;
          currentUnderlineLine = charLine;
          currentUnderlineTint = charTint;
        } else {
          currentUnderlineStart = null;
        }
      }

      // Handle strikethrough runs - break on strikethrough change, line change, or color change
      if (formatting?.strikeThrough && currentStrikeStart === null) {
        currentStrikeStart = i;
        currentStrikeLine = charLine;
        currentStrikeTint = charTint;
      } else if (
        currentStrikeStart !== null &&
        (!formatting?.strikeThrough || charLine !== currentStrikeLine || charTint !== currentStrikeTint)
      ) {
        runs.push({
          startCharIdx: currentStrikeStart,
          endCharIdx: i - 1,
          line: currentStrikeLine,
          type: 'strikethrough',
          tint: currentStrikeTint,
        });
        if (formatting?.strikeThrough) {
          currentStrikeStart = i;
          currentStrikeLine = charLine;
          currentStrikeTint = charTint;
        } else {
          currentStrikeStart = null;
        }
      }
    }

    // Convert runs to rectangles
    for (const run of runs) {
      const startChar = this.chars[run.startCharIdx];
      const endChar = this.chars[run.endCharIdx];

      const yOffset = run.type === 'underline' ? this.underlineOffset : this.strikeThroughOffset;
      const height = this.lineHeight * run.line + yOffset * scale;
      const yPos = this.position.y + height + scaledFixY;

      if (yPos < clipTop || yPos + HORIZONTAL_LINE_THICKNESS > clipBottom) continue;

      // Calculate x positions from character positions
      let startHorizontalOffset =
        startChar.position.x +
        this.horizontalAlignOffsets[startChar.line] * (this.align === 'justify' ? startChar.prevSpaces : 1);
      if (this.roundPixels) startHorizontalOffset = Math.round(startHorizontalOffset);
      const startXPos = Math.max(this.position.x + startHorizontalOffset * scale + OPEN_SANS_FIX.x, clipLeft);

      let endHorizontalOffset =
        endChar.position.x +
        this.horizontalAlignOffsets[endChar.line] * (this.align === 'justify' ? endChar.prevSpaces : 1);
      if (this.roundPixels) endHorizontalOffset = Math.round(endHorizontalOffset);
      const endXPos = this.position.x + endHorizontalOffset * scale + OPEN_SANS_FIX.x;
      const endCharWidth = endChar.charData.frame.width * scale;
      const lineEndX = Math.min(endXPos + endCharWidth, clipRight);

      const width = lineEndX - startXPos;
      if (width > 0) {
        const rect = new Rectangle(startXPos, yPos, width, HORIZONTAL_LINE_THICKNESS);
        this.horizontalLines.push({ rect, tint: run.tint });
      }
    }
    // Note: We intentionally don't update textHeight here. Underlines/strikethroughs
    // are decorative and shouldn't affect text height for layout purposes.
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
