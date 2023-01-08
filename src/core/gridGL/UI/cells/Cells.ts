import { Container, Graphics, Point, Rectangle } from 'pixi.js';
import { CELL_TEXT_MARGIN_LEFT, CELL_TEXT_MARGIN_TOP } from '../../../../constants/gridConstants';
import { debugShowQuadrantBoxes } from '../../../../debugFlags';
import { CellRectangle } from '../../../gridDB/CellRectangle';
import { CellAndFormat } from '../../../gridDB/GridSparse';
import { Cell, CellFormat } from '../../../gridDB/gridTypes';
import { debugGetColor } from '../../helpers/debugColors';
import { intersects } from '../../helpers/intersects';
import { PixiApp } from '../../pixiApp/PixiApp';
import { Coordinate, coordinateEqual } from '../../types/size';
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
   * update visual dependency graph for labels generated via quadrants
   * note: this will not remove dependencies for cells that have been deleted but had dependencies
   */
  private handleOverflow(): void {
    const labels = this.labels.get();
    const { quadrants } = this.app;
    const { dependency, gridOffsets } = this.app.sheet;
    const changes: Coordinate[] = [];
    labels.forEach(label => {
      if (!label.location) return;
      if (!label.overflowLeft && !label.overflowRight) {
        dependency.empty(label.location);
      } else {
        const dependents: Coordinate[] = [];

        // find cells that overflow to the right
        if (label.overflowRight) {
          let column = label.location.x + 1;
          let x = 0;
          do {
            dependents.push({ x: column, y: label.location.y });
            x += gridOffsets.getColumnPlacement(column).width;
            column++;
          } while (x < label.overflowRight);
        }

        // find cells that overflow to the left
        if (label.overflowLeft) {
          let column = label.location.x - 1;
          let x = 0;
          do {
            dependents.push({ x: column, y: label.location.y });
            x -= gridOffsets.getColumnPlacement(column).width;
            column--;
          } while (x > label.overflowLeft);
        }

        changes.push(...dependency.update(label.location, dependents));
      }
    });

    // mark quadrants of changed cells dirty
    if (changes.length) {
      quadrants.quadrantChanged({ cells: changes });
    }
  }

  private renderCell(options: {
    entry?: CellAndFormat;
    x: number;
    y: number;
    width: number;
    height: number;
    isQuadrant?: boolean;
    content: Rectangle;
    isInput?: boolean;
  }): boolean {
    const { entry, x, y, width, height, isQuadrant, content, isInput } = options;
    if (entry) {
      const hasContent = entry.cell?.value || entry.format;

      if (hasContent) {
        if (x < content.left) content.x = x;
        if (y < content.top) content.y = y;
      }

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
            isQuadrant,
            expectedWidth: width - CELL_TEXT_MARGIN_LEFT * 2,
            location: isQuadrant ? { x: entry.cell.x, y: entry.cell.y } : undefined,
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
      return true;
    }
    return false;
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
    isQuadrant?: boolean;
  }): Rectangle | undefined {
    const { bounds, cellRectangle, ignoreInput, isQuadrant } = options;

    const { gridOffsets, dependency, grid } = this.app.sheet;
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

    const dependentCells: Coordinate[] = [];

    // iterate through the rows and columns
    for (let row = bounds.top; row <= bounds.bottom; row++) {
      let x = xStart;
      const height = gridOffsets.getRowHeight(row);
      for (let column = bounds.left; column <= bounds.right; column++) {
        const width = gridOffsets.getColumnWidth(column);

        // track dependents that are outside the bounds of this rectangle
        const dependents = dependency.getDependents({ x: column, y: row });
        if (dependents?.length) {
          const outsideDependents = dependents.filter(dependent => !intersects.rectanglePoint(bounds, new Point(dependent.x, dependent.y)));
          if (outsideDependents.length) {

            // ensure no duplicates
            outsideDependents.forEach(dependent => {
              if (!dependentCells.find(search => coordinateEqual(search, dependent))) {
                dependentCells.push(dependent);
              }
            });
          }
        }

        const entry = cellRectangle.get(column, row);

        // don't render input (unless ignoreInput === true)
        const isInput = input && input.column === column && input.row === row;

        const rendered = this.renderCell({ entry, x, y, width, height, isQuadrant, content, isInput });
        blank = blank === true ? !rendered : blank;
        x += width;
      }
      x = xStart;
      y += height;
    }

    if (dependentCells.length) {
      dependentCells.forEach(coordinate => {
        const entry = grid.get(coordinate.x, coordinate.y);
        if (entry) {
          const position = gridOffsets.getCell(coordinate.x, coordinate.y);
          const isInput = input && input.column === coordinate.x && input.row === coordinate.y;
          this.renderCell({ entry, ...position, content, isInput });
        }
      });
    }

    this.labels.update();

    // only calculate overflow when rendering quadrants so it's only done one time
    if (isQuadrant) this.handleOverflow();

    return !blank ? content : undefined;
  }

  drawMultipleBounds(cellRectangles: CellRectangle[]): void {
    const { gridOffsets } = this.app.sheet;
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
                  expectedWidth: width,
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
    const { grid, borders } = this.app.sheet;
    const bounds = grid.getBounds(visibleBounds);
    const cellRectangle = grid.getCells(bounds);
    const rectCells = this.drawBounds({ bounds, cellRectangle, isQuadrant });

    // draw borders
    const borderBounds = borders.getBounds(visibleBounds);
    const bordersList = borders.getBorders(borderBounds);
    const rectBorders = this.cellsBorder.drawBorders(bordersList);

    const fullBounds = intersects.rectangleUnion(rectCells, rectBorders);

    if (isQuadrant && debugShowQuadrantBoxes && fullBounds) {
      this.debug.clear();
      this.debug.beginFill(debugGetColor(), 0.25);
      this.debug.drawShape(fullBounds);
      this.debug.endFill();
    }

    return fullBounds;
  }

  changeVisibility(visible: boolean): void {
    this.visible = visible;
    this.cellsBackground.visible = visible;
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
