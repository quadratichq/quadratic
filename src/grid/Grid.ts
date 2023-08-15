import { Rectangle } from 'pixi.js';
import { Pos, Rect, Grid as RustGrid } from '../quadratic-core/quadratic_core';
import { JsRenderCell, JsRenderFill } from '../quadratic-core/types';
import { GridFile } from '../schemas';

const rectangleToRect = (rectangle: Rectangle): Rect => {
  return new Rect(new Pos(rectangle.left, rectangle.top), new Pos(rectangle.right, rectangle.bottom));
};

const pointsToRect = (x: number, y: number, width: number, height: number): Rect => {
  return new Rect(new Pos(x, y), new Pos(x + width, y + height));
};

// TS wrapper around Grid.rs
export class Grid {
  // should be private after migration
  grid: RustGrid;

  constructor() {
    this.grid = new RustGrid();
  }

  // todo: remove return value (used to keep TS sheetController running)
  newFromFile(grid: GridFile): RustGrid {
    this.grid = RustGrid.newFromFile(grid);
    return this.grid;
  }

  getSheetOrder(sheetId: string): number | undefined {
    return this.grid.sheetIdToIndex(sheetId);
  }

  getSheetName(sheetId: string): string | undefined {
    const json = this.grid.getSheetMetaData(sheetId);
    return JSON.parse(json).name;
  }

  getSheetColor(sheetId: string): string | undefined {
    const json = this.grid.getSheetMetaData(sheetId);
    return JSON.parse(json).color;
  }

  getRenderCells(sheetId: string, rectangle: Rectangle): JsRenderCell[] {
    const data = this.grid.getRenderCells(sheetId, rectangleToRect(rectangle));
    return JSON.parse(data);
  }

  getRenderFills(sheetId: string, rectangle: Rectangle): JsRenderFill[] {
    const data = this.grid.getRenderFills(sheetId, rectangleToRect(rectangle));
    return JSON.parse(data);
  }

  sheetIndexToId(index: number): string | undefined {
    return this.grid.sheetIndexToId(index);
  }

  getGridBounds(sheetId: string, ignoreFormatting: boolean): Rectangle | undefined {
    const bounds = this.grid.getGridBounds(sheetId, ignoreFormatting);
    if (bounds.type === 'empty') {
      return;
    }
    return new Rectangle(bounds.min.x, bounds.min.y, bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y);
  }

  populateWithRandomFloats(sheetId: string, width: number, height: number): void {
    this.grid.populateWithRandomFloats(sheetId, pointsToRect(0, 0, width, height));
  }
}
