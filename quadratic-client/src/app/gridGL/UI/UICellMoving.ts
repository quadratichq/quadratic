import { events, type DirtyObject } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { checkMoveDestinationInvalid } from '@/app/gridGL/interaction/pointer/moveInvalid';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { Container, Graphics } from 'pixi.js';

const MOVING_THICKNESS = 2;
const COL_ROW_ALPHA = 0.25;
const INVALID_ALPHA = 0.3; // Opacity for invalid drop zones

export class UICellMoving extends Container {
  private graphics: Graphics;
  dirty = false;

  constructor() {
    super();
    this.graphics = this.addChild(new Graphics());
    this.visible = false;

    events.on('setDirty', this.setDirty);
  }

  destroy() {
    events.off('setDirty', this.setDirty);
    super.destroy();
  }

  private setDirty = (dirty: DirtyObject) => {
    if (dirty.cellMoving) {
      this.dirty = true;
    }
  };

  // Check if the destination is over a table header (invalid drop zone)
  private isDestinationInvalid(): boolean {
    const moving = pixiApp.pointer.pointerCellMoving.movingCells;
    if (!moving) return false;

    return checkMoveDestinationInvalid(
      moving.toColumn ?? 0,
      moving.toRow ?? 0,
      moving.width ?? 1,
      moving.height ?? 1,
      moving.colRows,
      moving.original,
      moving.additionalTables
    );
  }

  // determines whether the move is legal (not sure we want this feature)
  private borderColor() {
    if (this.isDestinationInvalid()) {
      return getCSSVariableTint('destructive');
    }
    return getCSSVariableTint('primary');
  }

  private drawMove() {
    const moving = pixiApp.pointer.pointerCellMoving.movingCells;
    if (!moving) {
      throw new Error('Expected moving to be defined in drawMove');
    }
    this.visible = true;
    this.graphics.clear();
    const isInvalid = this.isDestinationInvalid();
    this.graphics.lineStyle({ color: this.borderColor(), width: MOVING_THICKNESS });
    const sheet = sheets.sheet;
    if (moving.colRows) {
      this.drawMovingColRow();
      return;
    }
    if (
      moving.toColumn === undefined ||
      moving.toRow === undefined ||
      moving.width === undefined ||
      moving.height === undefined
    ) {
      throw new Error('Expected non-colRows moving to be defined in drawMove');
    }

    // Calculate delta for additional tables
    const deltaX = moving.toColumn - (moving.column ?? 0);
    const deltaY = moving.toRow - (moving.row ?? 0);

    const start = sheet.getCellOffsets(moving.toColumn, moving.toRow);
    const end = sheet.getCellOffsets(moving.toColumn + moving.width - 1, moving.toRow + moving.height - 1);
    const rectX = start.x;
    const rectY = start.y;
    const rectWidth = end.x + end.width - start.x;
    const rectHeight = end.y + end.height - start.y;

    // Draw red fill if invalid
    if (isInvalid) {
      this.graphics.lineStyle(); // Clear line style
      this.graphics.beginFill(getCSSVariableTint('destructive'), INVALID_ALPHA);
      this.graphics.drawRect(rectX, rectY, rectWidth, rectHeight);
      this.graphics.endFill();
    }

    // Draw the border rectangle for the primary table
    this.graphics.lineStyle({ color: this.borderColor(), width: MOVING_THICKNESS });
    this.graphics.drawRect(rectX, rectY, rectWidth, rectHeight);

    // Draw additional tables
    if (moving.additionalTables) {
      for (const table of moving.additionalTables) {
        const tableDestCol = Math.max(1, table.column + deltaX);
        const tableDestRow = Math.max(1, table.row + deltaY);
        const tableStart = sheet.getCellOffsets(tableDestCol, tableDestRow);
        const tableEnd = sheet.getCellOffsets(tableDestCol + table.width - 1, tableDestRow + table.height - 1);
        const tableRectX = tableStart.x;
        const tableRectY = tableStart.y;
        const tableRectWidth = tableEnd.x + tableEnd.width - tableStart.x;
        const tableRectHeight = tableEnd.y + tableEnd.height - tableStart.y;

        // Draw red fill if invalid
        if (isInvalid) {
          this.graphics.lineStyle(); // Clear line style
          this.graphics.beginFill(getCSSVariableTint('destructive'), INVALID_ALPHA);
          this.graphics.drawRect(tableRectX, tableRectY, tableRectWidth, tableRectHeight);
          this.graphics.endFill();
        }

        // Draw the border rectangle for this additional table
        this.graphics.lineStyle({ color: this.borderColor(), width: MOVING_THICKNESS });
        this.graphics.drawRect(tableRectX, tableRectY, tableRectWidth, tableRectHeight);
      }
    }
  }

  // draw moving columns and rows (this is the cut and paste version when dragging from the headers)
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

  // draw moving columns and rows (this is the normal cell move for entire rows and columns)
  private drawMovingColRow() {
    const moving = pixiApp.pointer.pointerCellMoving.movingCells;
    if (!moving) {
      throw new Error('Expected moving to be defined in drawColRow');
    }
    this.visible = true;
    this.graphics.clear();
    const isInvalid = this.isDestinationInvalid();
    this.graphics.lineStyle({ color: this.borderColor(), width: MOVING_THICKNESS });
    const sheet = sheets.sheet;
    const isColumn = moving.colRows === 'columns';
    const bounds = pixiApp.viewport.getVisibleBounds();
    const startX = isColumn && moving.toColumn ? sheet.getColumnX(moving.toColumn) : bounds.left;
    const endX = isColumn && moving.toColumn ? sheet.getColumnX(moving.toColumn + (moving.width ?? 1)) : bounds.right;
    const startY = !isColumn && moving.toRow ? sheet.getRowY(moving.toRow) : bounds.top;
    const endY = !isColumn && moving.toRow ? sheet.getRowY(moving.toRow + (moving.height ?? 1)) : bounds.bottom;

    if (isColumn) {
      const rectWidth = endX - startX;
      const rectHeight = bounds.bottom - bounds.y;

      // Draw red fill if invalid
      if (isInvalid) {
        this.graphics.lineStyle(); // Clear line style
        this.graphics.beginFill(getCSSVariableTint('destructive'), INVALID_ALPHA);
        this.graphics.drawRect(startX, bounds.y, rectWidth, rectHeight);
        this.graphics.endFill();
      }

      // Draw the border lines
      this.graphics.lineStyle({ color: this.borderColor(), width: MOVING_THICKNESS });
      this.graphics.moveTo(startX, bounds.y);
      this.graphics.lineTo(startX, bounds.bottom);
      this.graphics.moveTo(endX, bounds.y);
      this.graphics.lineTo(endX, bounds.bottom);
    } else {
      const rectWidth = bounds.right - bounds.left;
      const rectHeight = endY - startY;

      // Draw red fill if invalid
      if (isInvalid) {
        this.graphics.lineStyle(); // Clear line style
        this.graphics.beginFill(getCSSVariableTint('destructive'), INVALID_ALPHA);
        this.graphics.drawRect(bounds.left, startY, rectWidth, rectHeight);
        this.graphics.endFill();
      }

      // Draw the border lines
      this.graphics.lineStyle({ color: this.borderColor(), width: MOVING_THICKNESS });
      this.graphics.moveTo(bounds.left, startY);
      this.graphics.lineTo(bounds.right, startY);
      this.graphics.moveTo(bounds.left, endY);
      this.graphics.lineTo(bounds.right, endY);
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
