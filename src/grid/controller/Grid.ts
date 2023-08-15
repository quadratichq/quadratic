import { Rectangle } from 'pixi.js';
import { GridController, Pos, Rect } from '../../quadratic-core/quadratic_core';
import { JsRenderCell, JsRenderFill, TransactionSummary } from '../../quadratic-core/types';
import { GridFile } from '../../schemas';

const rectangleToRect = (rectangle: Rectangle): Rect => {
  return new Rect(new Pos(rectangle.left, rectangle.top), new Pos(rectangle.right, rectangle.bottom));
};

const pointsToRect = (x: number, y: number, width: number, height: number): Rect => {
  return new Rect(new Pos(x, y), new Pos(x + width, y + height));
};

// TS wrapper around Grid.rs
export class Grid {
  // should be private after migration
  gridController?: GridController;

  // import/export

  newFromFile(grid: GridFile): void {
    this.gridController = GridController.newFromFile(grid);
  }

  populateWithRandomFloats(sheetId: string, width: number, height: number): void {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    this.gridController.populateWithRandomFloats(sheetId, pointsToRect(0, 0, width, height));
  }

  // sheets

  sheetIndexToId(index: number): string | undefined {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.sheetIndexToId(index);
  }

  getSheetIds(): string[] {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    const data = this.gridController.getSheetIds();
    return JSON.parse(data);
  }

  addSheet(): string | undefined {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.addSheet();
  }

  deleteSheet(id: string): void {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.deleteSheet(id);
  }

  duplicateSheet(sheetId: string): TransactionSummary {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.duplicateSheet(sheetId);
  }

  getSheetOrder(sheetId: string): number | undefined {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    return this.gridController.sheetIdToIndex(sheetId);
  }

  getSheetName(sheetId: string): string | undefined {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    const json = this.gridController.getSheetMetaData(sheetId);
    return JSON.parse(json).name;
  }

  getSheetColor(sheetId: string): string | undefined {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    const json = this.gridController.getSheetMetaData(sheetId);
    return JSON.parse(json).color;
  }

  // get grid components

  getRenderCells(sheetId: string, rectangle: Rectangle): JsRenderCell[] {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    const data = this.gridController.getRenderCells(sheetId, rectangleToRect(rectangle));
    return JSON.parse(data);
  }

  getRenderFills(sheetId: string, rectangle: Rectangle): JsRenderFill[] {
    if (!this.gridController) throw new Error('Expected grid to be defined in Grid');
    const data = this.gridController.getRenderFills(sheetId, rectangleToRect(rectangle));
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
}
