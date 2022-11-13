import { Container, Rectangle } from 'pixi.js';
import { CELL_TEXT_MARGIN_LEFT, CELL_TEXT_MARGIN_TOP } from '../../../../constants/gridConstants';
import { Cell, CellFormat } from '../../../gridDB/db';
import { PixiApp } from '../../pixiApp/PixiApp';
import { CellsArray } from './CellsArray';
import { CellsBackground } from './cellsBackground';
import { CellsBorder } from './CellsBorder';
import { CellsLabels } from './CellsLabels';
import { CellsMarkers } from './CellsMarkers';

export interface CellsBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ICellsDraw {
  x: number;
  y: number;
  width: number;
  height: number;
  cell?: Cell;
  format?: CellFormat;
}

export class Cells extends Container {
  private app: PixiApp;
  private cellsArray: CellsArray;
  private cellsBorder: CellsBorder;
  private labels: CellsLabels;
  private cellsMarkers: CellsMarkers;
  cellsBackground: CellsBackground;
  dirty = true;

  constructor(app: PixiApp) {
    super();
    this.app = app;

    // this is added directly in pixiApp to control z-index (instead of using pixi's sortable children)
    this.cellsBackground = new CellsBackground();
    this.cellsArray = this.addChild(new CellsArray(app));
    this.cellsBorder = this.addChild(new CellsBorder(app));
    this.labels = this.addChild(new CellsLabels());
    this.cellsMarkers = this.addChild(new CellsMarkers());
  }

  // todo
  drawSubQuadrant(bounds: Rectangle): void {
    this.drawBounds(bounds);

    // ensure a screen rerender after a quadrant draw
    this.dirty = true;
  }

  private drawBounds(bounds: Rectangle) {
    const { grid, gridOffsets } = this.app;
    this.labels.clear();
    this.cellsMarkers.clear();
    this.cellsArray.clear();
    this.cellsBackground.clear();
    this.cellsBorder.clear();

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
          if (!isInput && (cell.cell || cell.format)) {
            this.cellsBorder.draw({ ...cell, x, y, width, height });
            this.cellsBackground.draw({ ...cell, x, y, width, height });
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
          }
          if (cell.cell?.array_cells) {
            this.cellsArray.draw(cell.cell.array_cells, x, y, width, height);
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

  debugShowCachedCounts(): void {
    this.cellsArray.debugShowCachedCounts();
    this.cellsBorder.debugShowCachedCounts();
    // this.labels.debugShowCachedCount();
    this.cellsMarkers.debugShowCachedCounts();
    this.cellsBackground.debugShowCachedCounts();
  }
}
