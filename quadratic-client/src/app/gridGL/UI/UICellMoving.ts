import { events, type DirtyObject } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { Container, Graphics, type Point, type Rectangle } from 'pixi.js';

const MOVING_THICKNESS = 2;
const COL_ROW_ALPHA = 0.25;
const INVALID_ALPHA = 0.3; // Opacity for invalid drop zones

export class UICellMoving extends Container {
  private graphics: Graphics;
  private overlaps?: Point[];
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

  // Check if a cell is within the original rectangle (for table moves)
  static isInOriginalRect(x: number, y: number, original?: Rectangle): boolean {
    if (!original) return false;
    return (
      x >= original.left &&
      x < original.left + original.width &&
      y >= original.top &&
      y < original.top + original.height
    );
  }

  // Check if a cell is in a code table (not a data/import table)
  static isInCodeTable(x: number, y: number): boolean {
    const table = content.cellsSheet.tables.getTableIntersects({ x, y });
    if (!table) return false;

    // Code tables have language !== 'Import', data tables have language === 'Import'
    return table.codeCell.language !== 'Import';
  }

  // Check if a cell is in a different table than the original
  // Only returns true if we're moving a table (original is set) and dropping into a different table
  static isInDifferentTable(x: number, y: number, original?: Rectangle): boolean {
    // If there's no original, we're not moving a table, so it's valid to drop into a table
    if (!original) return false;

    const table = content.cellsSheet.tables.getTableIntersects({ x, y });
    if (!table) return false;

    // Check if this table's position matches the original rectangle
    // The original rectangle represents the table's bounds
    const tableX = table.codeCell.x;
    const tableY = table.codeCell.y;

    // If the table's origin matches the original rectangle's origin, it's the same table
    return !(tableX === original.left && tableY === original.top);
  }

  // Check if the destination is over a table header (invalid drop zone)
  private isDestinationInvalid(): boolean {
    const moving = pixiApp.pointer.pointerCellMoving.movingCells;
    if (!moving) return false;

    const destX = moving.toColumn ?? 0;
    const destY = moving.toRow ?? 0;
    const isMovingColumns = moving.colRows === 'columns';
    const isMovingRows = moving.colRows === 'rows';
    const original = moving.original;

    if (isMovingColumns) {
      // Moving columns: check all rows in the destination column range
      const destWidth = moving.width ?? 1;
      const bounds = sheets.sheet.bounds;
      const maxRow = bounds.type === 'nonEmpty' ? Number(bounds.max.y) : 1;

      for (let x = destX; x < destX + destWidth; x++) {
        for (let y = 1; y <= maxRow; y++) {
          // Skip if this cell is in the original position (allowing drop on itself)
          if (UICellMoving.isInOriginalRect(x, y, original)) {
            continue;
          }
          // Check if dropping into a code table (not allowed for any content)
          if (UICellMoving.isInCodeTable(x, y)) {
            return true;
          }
          // Check if dropping into another table (only invalid when moving a table)
          if (UICellMoving.isInDifferentTable(x, y, original)) {
            return true;
          }
          if (content.cellsSheet.tables.isInTableHeader({ x, y })) {
            return true;
          }
        }
      }
    } else if (isMovingRows) {
      // Moving rows: check all columns in the destination row range
      const destHeight = moving.height ?? 1;
      const bounds = sheets.sheet.bounds;
      const maxCol = bounds.type === 'nonEmpty' ? Number(bounds.max.x) : 1;

      for (let y = destY; y < destY + destHeight; y++) {
        for (let x = 1; x <= maxCol; x++) {
          // Skip if this cell is in the original position (allowing drop on itself)
          if (UICellMoving.isInOriginalRect(x, y, original)) {
            continue;
          }
          // Check if dropping into a code table (not allowed for any content)
          if (UICellMoving.isInCodeTable(x, y)) {
            return true;
          }
          // Check if dropping into another table (only invalid when moving a table)
          if (UICellMoving.isInDifferentTable(x, y, original)) {
            return true;
          }
          if (content.cellsSheet.tables.isInTableHeader({ x, y })) {
            return true;
          }
        }
      }
    } else {
      // Regular cell move: check the specific rectangle
      const destWidth = moving.width ?? 1;
      const destHeight = moving.height ?? 1;

      for (let x = destX; x < destX + destWidth; x++) {
        for (let y = destY; y < destY + destHeight; y++) {
          // Skip if this cell is in the original position (allowing drop on itself)
          if (UICellMoving.isInOriginalRect(x, y, original)) {
            continue;
          }
          // Check if dropping into a code table (not allowed for any content)
          if (UICellMoving.isInCodeTable(x, y)) {
            return true;
          }
          // Check if dropping into another table (only invalid when moving a table)
          if (UICellMoving.isInDifferentTable(x, y, original)) {
            return true;
          }
          if (content.cellsSheet.tables.isInTableHeader({ x, y })) {
            return true;
          }
        }
      }
    }

    return false;
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

    // Draw the border rectangle
    this.graphics.lineStyle({ color: this.borderColor(), width: MOVING_THICKNESS });
    this.graphics.drawRect(rectX, rectY, rectWidth, rectHeight);
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
