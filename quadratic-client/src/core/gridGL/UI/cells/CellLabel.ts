import { Coordinate } from '../../types/size';
import { BitmapTextClip } from '../../pixiOverride/BitmapTextClip';

// todo: This does not implement RTL overlap clipping or more than 1 cell clipping

// todo: make this part of the cell's style data structure
const fontSize = 14;

export class CellLabel extends BitmapTextClip {
  location?: Coordinate;
  overflowRight?: number;
  overflowLeft?: number;
  originalText?: string;

  constructor() {
    super('', {
      fontName: 'OpenSans',
      fontSize,
      tint: 0,
      align: 'left',
    });
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