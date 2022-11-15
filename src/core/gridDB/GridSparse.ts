import { Rectangle } from 'pixi.js';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import { Cell } from './db';
import { GridController } from 'quadratic-core';

export class GridSparse {
  private app: PixiApp;
  private cells: Record<string, Cell> = {};
  private minX = 0;
  private maxX = 0;
  private minY = 0;
  private maxY = 0;
  private controller: GridController;

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

    const rect = this.controller.getCellRect();
    this.minX = Number(rect.x);
    this.minY = Number(rect.y);
    this.maxX = this.minX + Number(rect.w);
    this.maxY = this.minY + Number(rect.h);
  }

  get(x: number, y: number): Cell | undefined {
    return this.controller.get(x, y);
  }

  getBounds(bounds: Rectangle): Rectangle {
    const columnStartIndex = this.app.gridOffsets.getColumnIndex(bounds.left);
    const columnStart = columnStartIndex.index > this.minX ? columnStartIndex.index : this.minX;
    const columnEndIndex = this.app.gridOffsets.getColumnIndex(bounds.right);
    const columnEnd = columnEndIndex.index < this.maxX ? columnEndIndex.index : this.maxX;

    const rowStartIndex = this.app.gridOffsets.getRowIndex(bounds.top);
    const rowStart = rowStartIndex.index > this.minY ? rowStartIndex.index : this.minY;
    const rowEndIndex = this.app.gridOffsets.getRowIndex(bounds.bottom);
    const rowEnd = rowEndIndex.index < this.maxY ? rowEndIndex.index : this.maxY;

    return new Rectangle(columnStart, rowStart, columnEnd - columnStart, rowEnd - rowStart);
  }
}
