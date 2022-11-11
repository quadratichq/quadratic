import { Container, Graphics, Rectangle } from 'pixi.js';
import { CELL_TEXT_MARGIN_LEFT, CELL_TEXT_MARGIN_TOP } from '../../../../constants/gridConstants';
import { PixiApp } from '../../pixiApp/PixiApp';
import { CellsDraw } from './CellsDraw';
import { CellsLabels } from './CellsLabels';
import { CellsMarkers } from './CellsMarkers';
import { drawArray } from './drawArray';

export interface CellsBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class Cells extends Container {
  private app: PixiApp;
  private cellsDraw: CellsDraw;
  private labels: CellsLabels;
  private cellsMarkers: CellsMarkers;
  private cellsArray: Graphics;
  dirty = true;

  constructor(app: PixiApp) {
    super();
    this.app = app;
    this.cellsDraw = this.addChild(new CellsDraw(app));
    this.labels = this.addChild(new CellsLabels());
    this.cellsMarkers = this.addChild(new CellsMarkers());
    this.cellsArray = this.addChild(new Graphics());
  }

  drawSubQuadrant(bounds: Rectangle): void {
    this.drawBounds(bounds);

    // ensure a screen rerender after a quadrant draw
    this.dirty = true;
  }

  private drawBounds(bounds: Rectangle, ignoreInput?: boolean) {
    const { grid, gridOffsets } = this.app;
    this.labels.clear();
    this.cellsMarkers.clear();
    this.cellsDraw.clear();
    this.cellsArray.clear();

    const input = this.app.settings.interactionState.showInput
      ? {
          column: this.app.settings.interactionState.cursorPosition.x,
          row: this.app.settings.interactionState.cursorPosition.y,
        }
      : undefined;
    const xStart = gridOffsets.getColumnPlacement(bounds.left).x;
    let y = gridOffsets.getRowPlacement(bounds.top).y;
    for (let row = bounds.top; row <= bounds.bottom; row++) {
      let x = xStart;
      const height = gridOffsets.getRowHeight(row);
      for (let column = bounds.left; column <= bounds.right; column++) {
        const width = gridOffsets.getColumnWidth(column);

        const cell = grid.get(column, row);
        if (cell) {
          const isInput = input && input.column === column && input.row === row;
          if (!isInput) {
            this.cellsDraw.add({ ...cell, x, y, width, height });
          }
          if (cell.cell) {
            if (cell.cell?.type === 'PYTHON') {
              this.cellsMarkers.add(x, y, 'CodeIcon');
            }
            this.labels.add({
              x: x + CELL_TEXT_MARGIN_LEFT,
              y: y + CELL_TEXT_MARGIN_TOP,
              text: cell.cell.value,
            });
          }
          if (cell.cell?.array_cells) {
            drawArray({
              app: this.app,
              graphics: this.cellsArray,
              cellArray: cell.cell.array_cells,
              x,
              y,
              width,
              height,
            });
          }
        }
        x += width;
      }
      x = xStart;
      y += height;
    }
    this.labels.update();
  }

  update(): void {
    if (this.dirty) {
      this.dirty = false;
      const bounds = this.app.grid.getBounds(this.app.viewport.getVisibleBounds());
      this.drawBounds(bounds);
    }
  }
}
