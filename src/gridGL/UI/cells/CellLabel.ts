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

  setClip(width?: number): void {
    const newMaxWidth = width ?? 0;
    if (this.maxWidth !== newMaxWidth) {
      this.maxWidth = newMaxWidth;
      this.dirty = true;
    }
  }
}
