import { BitmapTextClip } from '../../pixiOverride/BitmapTextClip';
import { convertColorStringToTint } from '../../../helpers/convertColor';
import { LabelData } from './CellsLabels';
import { Point } from 'pixi.js';

// todo: This does not implement RTL overlap clipping or more than 1 cell clipping

// todo: make this part of the cell's style data structure
const fontSize = 14;

export class CellLabel extends BitmapTextClip {
  overflowRight?: number;
  overflowLeft?: number;
  lastPosition?: Point;
  data: LabelData;
  private lastClip: { clipLeft?: number; clipRight?: number } | undefined;

  constructor(data: LabelData) {
    super('', {
      fontName: 'OpenSans',
      fontSize,
      tint: 0,
      align: 'left',
    });
    this.data = data;
    this.setFormat();
  }

  setData(data: LabelData): void {
    this.data = data;
    this.setFormat();
  }

  private setFormat(): void {
    const format = this.data?.format;
    const bold = format?.bold ? 'Bold' : '';
    const italic = format?.italic ? 'Italic' : '';
    const fontName = `OpenSans${bold || italic ? '-' : ''}${bold}${italic}`;
    this.fontName = fontName;
    const textColor = format?.textColor;
    this.tint = textColor ? convertColorStringToTint(textColor) : 0;
  }

  set text(text: string) {
    text = String(text === null || text === undefined ? '' : text);
    this._text = text;
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
