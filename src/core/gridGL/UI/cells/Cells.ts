import { Container, Graphics } from 'pixi.js';
import { CELL_TEXT_MARGIN_LEFT, CELL_TEXT_MARGIN_TOP } from '../../../../constants/gridConstants';
import { PixiApp } from '../../pixiApp/PixiApp';
import { CellsLabels } from './CellsLabels';
import { CellsMarkers } from './CellsMarkers';
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
  private cellsMarkers: CellsMarkers;
  dirty = true;

  constructor(app: PixiApp) {
    super();
    this.app = app;
    this.cellBackgrounds = this.addChild(new Graphics());
    this.labels = this.addChild(new CellsLabels());
    this.cellsMarkers = this.addChild(new CellsMarkers());
  }

  private draw() {
    const { viewport, grid, gridOffsets, gridFormat: format } = this.app;
    this.labels.clear();
    this.cellsMarkers.clear();
    this.cellBackgrounds.clear();

    const input = this.app.settings.interactionState.showInput ? { column: this.app.settings.interactionState.cursorPosition.x, row: this.app.settings.interactionState.cursorPosition.y } : undefined;
    const bounds = grid.getBounds(viewport.getVisibleBounds());
    const xStart = gridOffsets.getColumnPlacement(bounds.left).x;
    let y = gridOffsets.getRowPlacement(bounds.top).y;
    for (let row = bounds.top; row <= bounds.bottom; row++) {
      let x = xStart;
      const height = gridOffsets.getRowHeight(row);
      for (let column = bounds.left; column <= bounds.right; column++) {
        const width = gridOffsets.getColumnWidth(column);

        // todo: combine the two lookups together
        const cell = grid.get(column, row);
        const cellFormat = format.get(column, row);

        const isInput = input && input.column === column && input.row === row;
        if (cellFormat && (!cell || isInput)) {
          drawCell({
            app: this.app,
            graphics: this.cellBackgrounds,
            cellFormat,
            x,
            y,
            width,
            height,
          });
        } else if (cell && !isInput) {
          drawCell({
            app: this.app,
            graphics: this.cellBackgrounds,
            cell,
            cellFormat,
            x,
            y,
            width,
            height,
          });
          if (cell.type === 'PYTHON') {
            this.cellsMarkers.add(x, y, 'CodeIcon');
          }
          this.labels.add({
            x: x + CELL_TEXT_MARGIN_LEFT,
            y: y + CELL_TEXT_MARGIN_TOP,
            text: cell.value,
          });
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
      this.draw();
    }
  }
}
