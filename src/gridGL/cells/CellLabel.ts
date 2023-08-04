import { Point, Rectangle } from 'pixi.js';
import { convertColorStringToTint } from '../../helpers/convertColor';
import { CellAlignment } from '../../schemas';
import { TextMesh } from '../pixiOverride/TextMesh';
import { CellsHash } from './CellsHash';
import { CellHash, CellRust } from './CellsTypes';

// todo: This does not implement RTL overlap clipping or more than 1 cell clipping

// todo: make this part of the cell's style data structure
const fontSize = 14;

export class CellLabel extends TextMesh implements CellHash {
  textSizeWidth: number = 0;
  textSizeHeight: number = 0;

  overflowRight?: number;
  overflowLeft?: number;
  lastPosition?: Point;

  // the topLeft position of the cell
  topLeft: Point;

  // the right position of the cell
  right: number;

  // used by CellHash
  AABB?: Rectangle;
  alignment: CellAlignment;
  hashes = new Set<CellsHash>();

  private lastClip: { clipLeft?: number; clipRight?: number } | undefined;

  constructor(cell: CellRust, rectangle: Rectangle) {
    const textColor = cell?.textColor;
    const tint = textColor ? convertColorStringToTint(textColor) : 0;
    super(cell.value.toString(), {
      fontName: 'OpenSans',
      fontSize,
      tint,
      align: 'left',
    });
    this.AABB = rectangle;
    this.topLeft = new Point(rectangle.x, rectangle.y);
    this.right = rectangle.right;
    this.position.set(rectangle.x, rectangle.y);

    const bold = cell?.bold ? 'Bold' : '';
    const italic = cell?.italic ? 'Italic' : '';
    const fontName = `OpenSans${bold || italic ? '-' : ''}${bold}${italic}`;
    if (this.fontName !== fontName) this.fontName = fontName;

    this.alignment = cell.align;
  }

  // set text(text: string) {
  //   text = String(text === null || text === undefined ? '' : text);
  //   if (this._text !== text) {
  //     this._text = text;
  //     this.dirty = true;
  //   }
  // }
  // get text() {
  //   return this._text;
  // }

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
