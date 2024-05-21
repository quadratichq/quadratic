import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { colors } from '@/app/theme/colors';
import { BitmapText, Container, Graphics } from 'pixi.js';

const MOVING_THICKNESS = 3;

export class UICellMoving extends Container {
  private graphics: Graphics;
  private location: BitmapText;

  dirty = false;

  constructor() {
    super();
    this.graphics = this.addChild(new Graphics());
    this.location = this.addChild(new BitmapText('', { fontName: 'OpenSans', fontSize: 12 }));
    this.visible = false;
  }

  private drawMove() {
    const moving = pixiApp.pointer.pointerCellMoving.moving;
    if (!moving) {
      throw new Error('Expected moving to be defined in drawMove');
    }
    this.visible = true;
    this.graphics.clear();
    this.graphics.lineStyle(1, colors.movingCells, MOVING_THICKNESS);
    const offsets = sheets.sheet.offsets;
    const start = offsets.getCellOffsets(moving.toColumn, moving.toRow);
    const end = offsets.getCellOffsets(moving.toColumn + moving.width, moving.toRow + moving.height);
    this.graphics.drawRect(start.x, start.y, end.x + end.w - start.x, end.y + end.h - start.y);
  }

  update() {
    if (this.dirty) {
      this.dirty = false;
      switch (pixiApp.pointer.pointerCellMoving.state) {
        case 'hover':
          if (this.visible) {
            this.visible = false;
          }
          break;
        case 'move':
          this.drawMove();
          break;
        default:
          if (this.visible) {
            this.visible = false;
          }
      }
    }
  }
}
