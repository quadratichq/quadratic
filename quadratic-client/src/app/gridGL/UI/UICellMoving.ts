import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { Container, Graphics, type Point } from 'pixi.js';

const MOVING_THICKNESS = 2;

export class UICellMoving extends Container {
  private graphics: Graphics;
  private overlaps?: Point[];
  dirty = false;

  constructor() {
    super();
    this.graphics = this.addChild(new Graphics());
    this.visible = false;
  }

  // determines whether the move is legal (not sure we want this feature)
  private borderColor() {
    // const moving = pixiApp.pointer.pointerCellMoving.movingCells;
    // if (!moving) {
    //   throw new Error('Expected moving to be defined in drawMove');
    // }
    // const cellsLabels = pixiApp.cellsSheet().cellsLabels;
    // const overlap = new Rectangle(moving.toColumn, moving.toRow, moving.width, moving.height);
    // if (cellsLabels.hasRectangle(overlap, moving.original ? [moving.original] : undefined)) {
    //   return getCSSVariableTint('warning');
    // }
    return getCSSVariableTint('primary');
  }

  private drawMove() {
    const moving = pixiApp.pointer.pointerCellMoving.movingCells;
    if (!moving) {
      throw new Error('Expected moving to be defined in drawMove');
    }
    this.visible = true;
    this.graphics.clear();
    this.graphics.lineStyle({ color: this.borderColor(), width: MOVING_THICKNESS });
    const sheet = sheets.sheet;
    const start = sheet.getCellOffsets(moving.toColumn, moving.toRow);
    const end = sheet.getCellOffsets(moving.toColumn + moving.width - 1, moving.toRow + moving.height - 1);
    this.graphics.drawRect(start.x, start.y, end.x + end.width - start.x, end.y + end.height - start.y);
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
