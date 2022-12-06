import { Container, Graphics, Rectangle } from 'pixi.js';
import { CELL_TEXT_MARGIN_LEFT, CELL_TEXT_MARGIN_TOP } from '../../../../constants/gridConstants';
import { debugShowQuadrantBoxes } from '../../../../debugFlags';
import { CellTextFormatter } from '../../../formatting/formatter';
import { CellRectangle } from '../../../gridDB/CellRectangle';
import { Cell, CellFormat } from '../../../gridDB/db';
import { debugGetColor } from '../../helpers/debugColors';
import { intersects } from '../../helpers/intersects';
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
  private debug: Graphics;
  private cellsArray: CellsArray;
  private cellsBorder: CellsBorder;
  private labels: CellsLabels;
  private cellsMarkers: CellsMarkers;

  cellsBackground: CellsBackground;
  dirty = true;

  constructor(app: PixiApp) {
    super();
    this.app = app;

    this.debug = this.addChild(new Graphics());

    // this is added directly in pixiApp to control z-index (instead of using pixi's sortable children)
    this.cellsBackground = new CellsBackground();

    this.cellsArray = this.addChild(new CellsArray(app));
    this.cellsBorder = this.addChild(new CellsBorder(app));
    this.labels = this.addChild(new CellsLabels());
    this.cellsMarkers = this.addChild(new CellsMarkers());
  }

  /**
   * Draws all items within the visible bounds
   * @param bounds visible bounds
   * @param cellRectangle data for entries within the visible bounds
   * @param ignoreInput if false then don't draw input location (as it's handled by the DOM)
   * @returns a Rectangle of the content bounds (not including empty area), or undefined if nothing is drawn
   */
  drawBounds(options: {
    bounds: Rectangle;
    cellRectangle: CellRectangle;
    ignoreInput?: boolean;
  }): Rectangle | undefined {
    const { bounds, cellRectangle, ignoreInput } = options;

    const { gridOffsets } = this.app;
    this.labels.clear();
    this.cellsMarkers.clear();
    this.cellsArray.clear();
    this.cellsBackground.clear();
    this.cellsBorder.clear();

    const input =
      !ignoreInput && this.app.settings.interactionState.showInput
        ? {
            column: this.app.settings.interactionState.cursorPosition.x,
            row: this.app.settings.interactionState.cursorPosition.y,
          }
        : undefined;

    // keeps track of screen position
    const xStart = gridOffsets.getColumnPlacement(bounds.left).x;
    const yStart = gridOffsets.getRowPlacement(bounds.top).y;
    let y = yStart;
    let blank = true;
    const content = new Rectangle(Infinity, Infinity, -Infinity, -Infinity);

    // iterate through the rows and columns
    for (let row = bounds.top; row <= bounds.bottom; row++) {
      let x = xStart;
      const height = gridOffsets.getRowHeight(row);
      for (let column = bounds.left; column <= bounds.right; column++) {
        const width = gridOffsets.getColumnWidth(column);
        const entry = cellRectangle.get(column, row);
        if (entry) {
          const hasContent = entry.cell?.value || entry.format;

          if (hasContent) {
            blank = false;
            if (x < content.left) content.x = x;
            if (y < content.top) content.y = y;
          }

          // don't render input (unless ignoreInput === true)
          const isInput = input && input.column === column && input.row === row;

          // only render if there is cell data, cell formatting
          if (!isInput && (entry.cell || entry.format)) {
            this.cellsBorder.draw({ ...entry, x, y, width, height });
            this.cellsBackground.draw({ ...entry, x, y, width, height });
            if (entry.cell) {
              if (entry.cell?.type === 'PYTHON') {
                this.cellsMarkers.add(x, y, 'CodeIcon');
              }
              this.labels.add({
                x: x + CELL_TEXT_MARGIN_LEFT,
                y: y + CELL_TEXT_MARGIN_TOP,
                text: CellTextFormatter(entry.cell),
              });
            }
          }
          if (entry.cell?.array_cells) {
            this.cellsArray.draw(entry.cell.array_cells, x, y, width, height);
          }

          if (hasContent) {
            if (x + width > content.right) content.width = x + width - content.left;
            if (y + height > content.bottom) content.height = y + height - content.top;
          }
        }
        x += width;
      }
      x = xStart;
      y += height;
    }

    if (!blank) {
      // renders labels
      this.labels.update();
      return content;
    }
  }

  drawMultipleBounds(cellRectangles: CellRectangle[]): void {
    const { gridOffsets } = this.app;
    this.labels.clear();
    this.cellsMarkers.clear();
    this.cellsArray.clear();
    this.cellsBackground.clear();
    this.cellsBorder.clear();

    let blank = true;
    for (const cellRectangle of cellRectangles) {
      const bounds = cellRectangle.size;

      // keeps track of screen position
      const xStart = gridOffsets.getColumnPlacement(bounds.left).x;
      const yStart = gridOffsets.getRowPlacement(bounds.top).y;
      let y = yStart;
      const content = new Rectangle(Infinity, Infinity, -Infinity, -Infinity);

      // iterate through the rows and columns
      for (let row = bounds.top; row <= bounds.bottom; row++) {
        let x = xStart;
        const height = gridOffsets.getRowHeight(row);
        for (let column = bounds.left; column <= bounds.right; column++) {
          const width = gridOffsets.getColumnWidth(column);
          const entry = cellRectangle.get(column, row);
          if (entry) {
            const hasContent = entry.cell?.value || entry.format;

            if (hasContent) {
              blank = false;
              if (x < content.left) content.x = x;
              if (y < content.top) content.y = y;
            }

            // don't render input (unless ignoreInput === true)
            const isInput = false; //input && input.column === column && input.row === row;

            // only render if there is cell data, cell formatting
            if (!isInput && (entry.cell || entry.format)) {
              this.cellsBorder.draw({ ...entry, x, y, width, height });
              this.cellsBackground.draw({ ...entry, x, y, width, height });
              if (entry.cell) {
                if (entry.cell?.type === 'PYTHON') {
                  this.cellsMarkers.add(x, y, 'CodeIcon');
                }
                this.labels.add({
                  x: x + CELL_TEXT_MARGIN_LEFT,
                  y: y + CELL_TEXT_MARGIN_TOP,
                  text: entry.cell.value,
                });
              }
            }
            if (entry.cell?.array_cells) {
              this.cellsArray.draw(entry.cell.array_cells, x, y, width, height);
            }

            if (hasContent) {
              if (x + width > content.right) content.width = x + width - content.left;
              if (y + height > content.bottom) content.height = y + height - content.top;
            }
          }
          x += width;
        }
        x = xStart;
        y += height;
      }

      if (cellRectangle.borders) {
        this.cellsBorder.drawBorders(cellRectangle.borders);
      }
    }

    if (!blank) {
      // renders labels
      this.labels.update();
    }
  }

  drawCells(visibleBounds: Rectangle, isQuadrant: boolean): Rectangle | undefined {
    const bounds = this.app.grid.getBounds(visibleBounds);
    const cellRectangle = this.app.grid.getCells(bounds);
    const rectCells = this.drawBounds({ bounds, cellRectangle });

    // draw borders
    const borderBounds = this.app.borders.getBounds(visibleBounds);
    const borders = this.app.borders.getBorders(borderBounds);
    const rectBorders = this.cellsBorder.drawBorders(borders);

    const fullBounds = intersects.rectangleUnion(rectCells, rectBorders);

    if (isQuadrant && debugShowQuadrantBoxes && fullBounds) {
      this.debug.clear();
      this.debug.beginFill(debugGetColor(), 0.25);
      this.debug.drawShape(fullBounds);
      this.debug.endFill();
    }

    return fullBounds;
  }

  update(): void {
    if (this.dirty) {
      this.dirty = false;
      const visibleBounds = this.app.viewport.getVisibleBounds();
      this.drawCells(visibleBounds, false);
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
