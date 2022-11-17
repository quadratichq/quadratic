import { Rectangle } from 'pixi.js';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import { Cell } from './db';
import { GridController } from 'quadratic-core';

export class GridSparse {
  private app: PixiApp;
  controller: GridController;

  constructor(app: PixiApp) {
    this.app = app;
    this.controller = new GridController();
  }

  empty() {
    this.controller.empty();
  }

  private getKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  populate(cells?: Cell[]) {
    if (cells === undefined) {
      this.empty();
    } else {
      this.controller.populate(JSON.stringify(cells));
    }
  }

  get(x: number, y: number): Cell | undefined {
    return this.controller.get(x, y);
  }

  getBounds(bounds: Rectangle): Rectangle {
    const gridBounds = this.controller.getCellBounds();

    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    if (gridBounds) {
      minX = Number(gridBounds.x);
      maxX = Number(gridBounds.x + gridBounds.w - 1);
      minY = Number(gridBounds.y);
      maxY = Number(gridBounds.y + gridBounds.h - 1);
    }

    const columnStartIndex = this.app.gridOffsets.getColumnIndex(bounds.left);
    const columnStart = columnStartIndex.index > minX ? columnStartIndex.index : minX;
    const columnEndIndex = this.app.gridOffsets.getColumnIndex(bounds.right);
    const columnEnd = columnEndIndex.index < maxX ? columnEndIndex.index : maxX;

    const rowStartIndex = this.app.gridOffsets.getRowIndex(bounds.top);
    const rowStart = rowStartIndex.index > minY ? rowStartIndex.index : minY;
    const rowEndIndex = this.app.gridOffsets.getRowIndex(bounds.bottom);
    const rowEnd = rowEndIndex.index < maxY ? rowEndIndex.index : maxY;

    return new Rectangle(columnStart, rowStart, columnEnd - columnStart, rowEnd - rowStart);
  }
}
