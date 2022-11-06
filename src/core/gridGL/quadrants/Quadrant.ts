import { Rectangle } from 'pixi.js';
import { CellAndFormat } from '../../gridDB/GridSparse';
import { PixiApp } from '../pixiApp/PixiApp';
import { QUADRANT_SIZE } from './quadrantConstants';
import { SubQuadrant } from './SubQuadrant';

export interface CellAndFormatAndPosition extends CellAndFormat {
  xPosition: number;
  yPosition: number;
  width: number;
  height: number;
}

// quadrants are column/row based texture stores of size Rectangle(column, row, QUADRANT_SIZE, QUADRANT_SIZE)
// quadrants only exist if there are cells within the rectangle range
export class Quadrant {
  private app: PixiApp;

  // each quadrant has 1 or more textures (based on actual row/column display size)
  private subQuadrants: SubQuadrant[] = [];
  private dirty = true;

  // these are the starting grid coordinates
  private x: number;
  private y: number;

  // these are the world coordinates for the textures
  private left = 0;
  private right = 0;
  private top = 0;
  private bottom = 0;

  constructor(app: PixiApp, x: number, y: number) {
    this.app = app;
    this.x = x;
    this.y = y;
  }

  update() {
    if (!this.dirty) return;
    this.dirty = false;

    const columnStart = this.app.gridOffsets.getColumnPlacement(this.x)
    const columnEnd = this.app.gridOffsets.getColumnPlacement(this.x + QUADRANT_SIZE);
    const rowStart = this.app.gridOffsets.getRowPlacement(this.y)
    const rowEnd = this.app.gridOffsets.getRowPlacement(this.y + QUADRANT_SIZE);

    const bounds = new Rectangle(
      columnStart.x,
      rowStart.y,
      columnEnd.x + columnEnd.width - this.x,
      rowEnd.y + rowEnd.height - this.y,
    );

    const { cells } = this.app;

    cells.drawSubQuadrant(bounds);
    const cellBounds = cells.getBounds();

    // const columnPlacement = this.app.gridOffsets.getColumnPlacement(this.x);
    // let xPosition = columnPlacement.x;
    // this.left = xPosition;

    // // save widths for columns (since these will be reused for each row)
    // const widths: number[] = [columnPlacement.width];
    // for (let i = 1; i <= QUADRANT_SIZE; i++) {
    //   widths.push(this.app.gridOffsets.getColumnWidth(this.x + i));
    // }

    // const rowPlacement = this.app.gridOffsets.getRowPlacement(this.y);
    // let yPosition = rowPlacement.y;
    // this.top = yPosition;

    // for (let y = 0; y <= QUADRANT_SIZE; y++) {
    //   const height = this.app.gridOffsets.getRowHeight(this.y);
    //   for (let x = 0; x <= QUADRANT_SIZE; x++) {
    //     const width = widths[x];
    //     const cell = this.app.grid.get(this.x + x, this.y + y);
    //     if (cell) {
    //       this.subQuadrants.forEach(subQuadrant => {
    //         if (subQuadrant.overlaps(xPosition, yPosition, xPosition + width, xPosition + height)) {
    //           this.subQuadrants
    //         }
    //     }
    //     xPosition += width;
    //   }
    //   yPosition += height;
    // }

  }
}