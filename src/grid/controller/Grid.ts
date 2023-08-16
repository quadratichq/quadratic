import { Point, Rectangle } from 'pixi.js';
import { GridController, Pos, Rect as RectInternal } from '../../quadratic-core/quadratic_core';
import { CellValue, JsRenderCell, JsRenderFill, Rect, TransactionSummary } from '../../quadratic-core/types';
import { GridFile } from '../../schemas';
import { SheetCursorSave } from '../sheet/SheetCursor';

const rectangleToRect = (rectangle: Rectangle): Rect => {
  return new RectInternal(new Pos(rectangle.left, rectangle.top), new Pos(rectangle.right, rectangle.bottom));
};

const pointsToRect = (x: number, y: number, width: number, height: number): Rect => {
  return new RectInternal(new Pos(x, y), new Pos(x + width, y + height));
};

export const rectToRectangle = (rect: Rect): Rectangle => {
  return new Rectangle(
    Number(rect.min.x),
    Number(rect.min.y),
    Number(rect.max.x - rect.min.x),
    Number(rect.max.y - rect.min.y)
  );
};

export const rectToPoint = (rect: Rect): Point => {
  if (rect.min.x !== rect.max.x || rect.min.y !== rect.max.x) {
    throw new Error('Expected rectToPoint to receive a rectangle with width/height = 1');
  }
  return new Point(Number(rect.min.x), Number(rect.min.y));
};

// TS wrapper around Grid.rs
export class Grid {
  // should be private after migration
  gridController?: GridController;

  // import/export

  createForTesting(): void {
    this.gridController = new GridController();
  }

  newFromFile(grid: GridFile): void {
    this.gridController = GridController.newFromFile(grid);
  }

  // sheet operations
  // ----------------

  populateWithRandomFloats(sheetId: string, width: number, height: number): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.populateWithRandomFloats(sheetId, pointsToRect(0, 0, width, height) as RectInternal);
  }

  getSheetIds(): string[] {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    const data = this.gridController.getSheetIds();
    return JSON.parse(data);
  }

  addSheet(cursor: SheetCursorSave): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.addSheet(undefined, JSON.stringify(cursor));
  }

  deleteSheet(sheetId: string, cursor: SheetCursorSave): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.deleteSheet(sheetId, JSON.stringify(cursor));
  }

  setSheetName(sheetId: string, name: string, cursor: SheetCursorSave): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.setSheetName(sheetId, name, JSON.stringify(cursor));
  }

  setSheetColor(sheetId: string, color: string | undefined, cursor: SheetCursorSave): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.setSheetColor(sheetId, color, JSON.stringify(cursor));
  }

  duplicateSheet(sheetId: string, cursor: SheetCursorSave): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.duplicateSheet(sheetId, JSON.stringify(cursor));
  }

  // sheet grid operations
  // ---------------------

  setCellValue(options: { sheetId: string; x: number; y: number; value: string; cursor: SheetCursorSave }) {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    const cellValue: CellValue = {
      type: 'text',
      value: options.value,
    };
    return this.gridController.setCellValue(
      options.sheetId,
      new Pos(options.x, options.y),
      cellValue,
      JSON.stringify(options.cursor)
    );
  }

  // sheet information
  // -----------------

  sheetIndexToId(index: number): string | undefined {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.sheetIndexToId(index);
  }

  getSheetOrder(sheetId: string): number | undefined {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.sheetIdToIndex(sheetId);
  }

  getSheetName(sheetId: string): string | undefined {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.getSheetName(sheetId);
  }

  getSheetColor(sheetId: string): string | undefined {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.getSheetColor(sheetId);
  }

  // rendering information
  // ---------------------

  getRenderCells(sheetId: string, rectangle: Rectangle): JsRenderCell[] {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    const data = this.gridController.getRenderCells(sheetId, rectangleToRect(rectangle) as RectInternal);
    return JSON.parse(data);
  }

  getRenderFills(sheetId: string, rectangle: Rectangle): JsRenderFill[] {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    const data = this.gridController.getRenderFills(sheetId, rectangleToRect(rectangle) as RectInternal);
    return JSON.parse(data);
  }

  getGridBounds(sheetId: string, ignoreFormatting: boolean): Rectangle | undefined {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    const bounds = this.gridController.getGridBounds(sheetId, ignoreFormatting);
    if (bounds.type === 'empty') {
      return;
    }
    return new Rectangle(bounds.min.x, bounds.min.y, bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y);
  }

  // undo
  //-----

  hasUndo(): boolean {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.hasUndo();
  }

  hasRedo(): boolean {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.hasRedo();
  }

  undo(cursor: SheetCursorSave): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.undo(JSON.stringify(cursor));
  }

  redo(cursor: SheetCursorSave): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.redo(JSON.stringify(cursor));
  }
}
