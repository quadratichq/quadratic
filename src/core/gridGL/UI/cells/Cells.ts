import { Container, Graphics } from 'pixi.js';
import { PixiApp } from '../../pixiApp/PixiApp';
import { CellsLabels } from './CellsLabels';
import { drawCell } from './drawCell';

export interface CellsBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class Cells extends Container {
  private app: PixiApp;
  private cellBackgrounds: Graphics;
  private labels: CellsLabels;
  dirty = true;

  constructor(app: PixiApp) {
    super();
    this.app = app;
    this.cellBackgrounds = this.addChild(new Graphics());
    this.labels = this.addChild(new CellsLabels());
  }

  private draw() {
    const { viewport, grid } = this.app;
    this.labels.clear();
    this.cellBackgrounds.clear();

    const bounds = viewport.getVisibleBounds();
    let columnIndex = this.app.gridOffsets.getColumnIndex(bounds.left);
    let column = columnIndex.index;
    const columnStart = column;
    const offsetX = bounds.left - columnIndex.position;
    const rowIndex = this.app.gridOffsets.getRowIndex(bounds.top);
    let row = rowIndex.index;
    const offsetY = bounds.top - rowIndex.position;
    let sizeY = 0;
    let nextY = this.app.gridOffsets.getRowHeight(row);
    let maxColumn = 0;
    for (let y = bounds.top; y <= bounds.bottom; y += sizeY) {
      sizeY = nextY;
      nextY = this.app.gridOffsets.getRowHeight(row + 1);
      let sizeX = 0;
      let nextX = this.app.gridOffsets.getColumnWidth(column);
      for (let x = bounds.left; x <= bounds.right + nextX; x += sizeX) {
        sizeX = nextX;
        nextX = this.app.gridOffsets.getColumnWidth(column + 1);
        const cell = grid.get(column, row);
        if (cell) {
          drawCell({
            graphics: this.cellBackgrounds,
            cell,
            x: x - offsetX,
            y: y - offsetY,
            width: sizeX,
            height: sizeY,
            gridOffsets: this.app.gridOffsets,
          });
          this.labels.add({
            x: x - offsetX,
            y: y - offsetY,
            text: cell.value,
          });
        }
        column++;
      }
      row++;
      maxColumn = Math.max(column, maxColumn)
      column = columnStart;
    }
    this.labels.update();
  }

  update(): void {
    if (this.dirty) {
      this.dirty = false;
      this.draw();
    }
  }
}