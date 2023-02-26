import { Coordinate } from '../../types/size';
import { BitmapTextClip } from '../../pixiOverride/BitmapTextClip';
import { CellFormat } from '../../../grid/sheet/gridTypes';
import { convertColorStringToTint } from '../../../helpers/convertColor';

// todo: This does not implement RTL overlap clipping or more than 1 cell clipping

// todo: make this part of the cell's style data structure
const fontSize = 14;

export class CellLabel extends BitmapTextClip {
  location?: Coordinate;
  overflowRight?: number;
  overflowLeft?: number;
  originalText?: string;
  format?: CellFormat;
  private lastClip: { clipLeft?: number; clipRight?: number } | undefined;

  constructor(format?: CellFormat) {
    super('', {
      fontName: 'OpenSans',
      fontSize,
      tint: 0,
      align: 'left',
    });
    this.setFormat(format);
  }

  setFormat(format?: CellFormat): void {
    const bold = format?.bold ? 'Bold' : '';
    const italic = format?.italic ? 'Italic' : '';
    const fontName = `OpenSans${bold || italic ? '-' : ''}${bold}${italic}`;
    this.fontName = fontName;
    this.format = format;
    const textColor = this.format?.textColor;
    this.tint = textColor ? convertColorStringToTint(textColor) : 0;
  }

  set text(text: string) {
    text = String(text === null || text === undefined ? '' : text);
    this._text = text;
    this.originalText = text;
    this.dirty = true;
  }
  get text() {
    return this._text;
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
}
