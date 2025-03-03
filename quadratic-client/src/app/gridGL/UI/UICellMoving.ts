import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { Container, Graphics, type Point } from 'pixi.js';

const MOVING_THICKNESS = 2;
const COL_ROW_ALPHA = 0.25;

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

  private drawColRow() {
    const moving = pixiApp.pointer.pointerHeading.movingColRows;
    if (!moving) {
      throw new Error('Expected movingColRows to be defined in drawColRow');
    }
    this.visible = true;
    this.graphics.clear();
    this.graphics.lineStyle({ color: this.borderColor(), width: MOVING_THICKNESS });
    const sheet = sheets.sheet;
    let line = moving.isColumn ? sheet.getColumnX(moving.place) : sheet.getRowY(moving.place);
    const length = moving.indicies[moving.indicies.length - 1] - moving.indicies[0] + 1;
    const bounds = pixiApp.viewport.getVisibleBounds();
    this.graphics.lineStyle();

    // draw the background
    this.graphics.beginFill(getCSSVariableTint('primary'), COL_ROW_ALPHA);
    const left = moving.isColumn ? sheets.sheet.getColumnX(moving.place - moving.offset) : bounds.left;
    const right = moving.isColumn ? sheets.sheet.getColumnX(moving.place + length - moving.offset) : bounds.right;
    const top = moving.isColumn ? bounds.top : sheets.sheet.getRowY(moving.place - moving.offset);
    const bottom = moving.isColumn ? bounds.bottom : sheets.sheet.getRowY(moving.place + length - moving.offset);
    this.graphics.drawRect(left, top, right - left, bottom - top);
    this.graphics.endFill();

    // draw the line indicating where the move will be inserted
    this.graphics.lineStyle({ color: this.borderColor(), width: MOVING_THICKNESS });
    if (moving.isColumn) {
      if (moving.offset !== 0) {
        line = sheet.getColumnX(moving.place);
      }
      this.graphics.moveTo(line, bounds.y);
      this.graphics.lineTo(line, bounds.bottom);
    } else {
      if (moving.offset !== 0) {
        line = sheet.getRowY(moving.place);
      }
      this.graphics.moveTo(bounds.left, line);
      this.graphics.lineTo(bounds.right, line);
    }
  }

  update = () => {
    if (!this.dirty) {
      return;
    }

    this.dirty = false;
    if (pixiApp.pointer.pointerHeading.movingColRows) {
      this.drawColRow();
    } else {
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
  };
}
