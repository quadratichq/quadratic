import { BitmapText, Container, Graphics } from 'pixi.js';
import { Coordinate } from '../../types/size';

// todo: make this part of the cell's style data structure
const fontSize = 14;

export class CellLabel extends Container {
  bitmapText: BitmapText;
  location?: Coordinate;
  overflowRight?: number;
  overflowLeft?: number;
  saveMask?: Graphics;

  constructor() {
    super();
    this.bitmapText = this.addChild(
      new BitmapText('', {
        fontName: 'OpenSans',
        fontSize,
        tint: 0,
        align: 'left',
      })
    );
  }

  get text(): string {
    return this.bitmapText.text;
  }
  set text(text: string) {
    this.bitmapText.text = text;
  }

  get textWidth(): number {
    return this.bitmapText.width;
  }

  setMask(width: number): void {
    let mask: Graphics;
    if (this.mask) {
      mask = this.mask as Graphics;
    } else if (this.saveMask) {
      mask = this.saveMask;
      mask.visible = true;
      mask.clear();
      this.mask = mask;
    } else {
      mask = this.addChild(new Graphics());
      this.mask = mask;
      this.saveMask = mask;
    }
    mask.beginFill(0, 0.25).drawRect(0, 0, width, this.bitmapText.maxLineHeight);
  }

  clearMask(): void {
    if (this.mask) {
      (this.mask as Graphics).visible = false;
      this.mask = null;
    }
  }
}