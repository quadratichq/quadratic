import { Coordinate } from '../types/size';
import { BitmapTextClip } from '../pixiOverride/BitmapTextClip';
import { CellFormat } from '../../grid/sheet/gridTypes';
import { convertColorStringToTint } from '../../helpers/convertColor';

// todo: This does not implement RTL overlap clipping or more than 1 cell clipping

// todo: make this part of the cell's style data structure
const fontSize = 14;

export class CellLabel extends BitmapTextClip {
  location: Coordinate;
  originalText?: string;
  dependents: Coordinate[] = [];

  constructor(text: string, location: Coordinate, format?: CellFormat) {
    super(text, {
      fontName: 'OpenSans',
      fontSize,
      tint: 0,
      align: 'left',
    });
    this.location = location;
    this.setFormat(format);
  }

  setFormat(format?: CellFormat): void {
    const bold = format?.bold ? 'Bold' : '';
    const italic = format?.italic ? 'Italic' : '';
    const fontName = `OpenSans${bold || italic ? '-' : ''}${bold}${italic}`;
    this.fontName = fontName;
    const textColor = format?.textColor;
    this.tint = textColor ? convertColorStringToTint(textColor) : 0;
  }

  set text(text: string) {
    if (text === this.originalText) return;
    this._text = text;
    this.originalText = text;
    this.dirty = true;
  }
  get text() {
    return this._text;
  }

  updateText(): void {
    super.updateText();

    // todo: this is where dependents go
  }
}
