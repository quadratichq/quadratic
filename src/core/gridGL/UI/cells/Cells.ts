import { Container, Graphics, Rectangle } from 'pixi.js';
import { CELL_TEXT_MARGIN_LEFT, CELL_TEXT_MARGIN_TOP } from '../../../../constants/gridConstants';
import { debugShowQuadrantBoxes } from '../../../../debugFlags';
import { CellRectangle } from '../../../gridDB/CellRectangle';
import { CellAndFormat } from '../../../gridDB/GridSparse';
import { Cell, CellFormat } from '../../../gridDB/gridTypes';
import { debugGetColor } from '../../helpers/debugColors';
import { intersects } from '../../helpers/intersects';
import { PixiApp } from '../../pixiApp/PixiApp';
import { Coordinate } from '../../types/size';
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

export interface CellsDraw {
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
    const labels = this.labels.getVisible();

    const { quadrants } = this.app;
    const { render_dependency, gridOffsets } = this.app.sheet;
    const changes: Coordinate[] = [];

    labels.forEach((label) => {
      if (!label.location) return;
      if (!label.overflowLeft && !label.overflowRight) {
        render_dependency.empty(label.location);
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

        changes.push(...render_dependency.update(label.location, dependents));
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
    isInput?: boolean;
  }): Rectangle | undefined {
    const { entry, x, y, width, height, isQuadrant, isInput } = options;
    if (entry) {
      const hasContent = entry.cell?.value || entry.format;

      // only render if there is cell data or cell formatting
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
        return new Rectangle(x, y, width, height);
      }
    }
  }

  /**
   * Draws all items within the visible bounds
   * @param boundsWithData visible bounds without cells outside of gridSparse bounds
   * @param  bounds visible bounds with cells outside of gridSparse bounds
   * @param cellRectangle data for entries within the visible bounds
   * @param ignoreInput if false then don't draw input location (as it's handled by the DOM)
   * @returns a Rectangle of the content bounds (not including empty area), or undefined if nothing is drawn
   */
  drawBounds(options: {
    boundsWithData: Rectangle;
    bounds: Rectangle;
    cellRectangle: CellRectangle;
    ignoreInput?: boolean;
    isQuadrant?: boolean;
  }): Rectangle | undefined {
    const { boundsWithData, bounds, cellRectangle, ignoreInput, isQuadrant } = options;
    const renderedCells = new Set<string>();

    const { gridOffsets, render_dependency, grid } = this.app.sheet;
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
    const xStart = gridOffsets.getColumnPlacement(boundsWithData.left).x;
    const yStart = gridOffsets.getRowPlacement(boundsWithData.top).y;
    let y = yStart;
    let content: Rectangle | undefined;

    // iterate through the rows and columns
    for (let row = boundsWithData.top; row <= boundsWithData.bottom; row++) {
      let x = xStart;
      const height = gridOffsets.getRowHeight(row);
      for (let column = boundsWithData.left; column <= boundsWithData.right; column++) {
        const width = gridOffsets.getColumnWidth(column);
        const entry = cellRectangle.get(column, row);

        // don't render input (unless ignoreInput === true)
        renderedCells.add(`${column},${row}`);
        const isInput = input && input.column === column && input.row === row;

        const rendered = this.renderCell({ entry, x, y, width, height, isQuadrant, isInput });
        content = content ? intersects.rectangleUnion(content, rendered) : rendered;
        x += width;
      }
      x = xStart;
      y += height;
    }

    // check for dependencies across entire bounds
    const dependentCells = render_dependency.getDependentsInBounds(bounds);
    if (dependentCells.length) {
      dependentCells.forEach((coordinate) => {
        const key = `${coordinate.x},${coordinate.y}`;
        if (renderedCells.has(key)) return;
        renderedCells.add(key);
        const entry = grid.get(coordinate.x, coordinate.y);
        if (entry) {
          const position = gridOffsets.getCell(coordinate.x, coordinate.y);
          const isInput = input && input.column === coordinate.x && input.row === coordinate.y;
          const rect = this.renderCell({ entry, ...position, isInput });
          content = content ? intersects.rectangleUnion(content, rect) : rect;
        }
      });
    }

    this.labels.update();

    // only calculate overflow when rendering quadrants so it's only done one time
    if (isQuadrant) this.handleOverflow();

    return content;
  }

  drawMultipleBounds(cellRectangles: CellRectangle[]): void {
    const { gridOffsets, render_dependency, grid } = this.app.sheet;
    this.labels.clear();
    this.cellsMarkers.clear();
    this.cellsArray.clear();
    this.cellsBackground.clear();
    this.cellsBorder.clear();

    // ensure every cell renders only once
    const renderedCells = new Set<string>();
    let content: Rectangle | undefined;

    const input = this.app.settings.interactionState.showInput
      ? {
          column: this.app.settings.interactionState.cursorPosition.x,
          row: this.app.settings.interactionState.cursorPosition.y,
        }
      : undefined;

    for (const cellRectangle of cellRectangles) {
      const bounds = cellRectangle.size;

      // keeps track of screen position
      const xStart = gridOffsets.getColumnPlacement(bounds.left).x;
      const yStart = gridOffsets.getRowPlacement(bounds.top).y;
      let y = yStart;

      // iterate through the rows and columns
      for (let row = bounds.top; row <= bounds.bottom; row++) {
        let x = xStart;
        const height = gridOffsets.getRowHeight(row);
        for (let column = bounds.left; column <= bounds.right; column++) {
          const width = gridOffsets.getColumnWidth(column);
          const entry = cellRectangle.get(column, row);
          const key = `${column},${row}`;
          if (!renderedCells.has(key)) {
            renderedCells.add(key);
            const isInput = input && input.column === column && input.row === row;
            const rect = this.renderCell({ entry, x, y, width, height, isInput });
            content = content ? intersects.rectangleUnion(content, rect) : rect;
          }
          x += width;
        }
        x = xStart;
        y += height;
      }

      if (cellRectangle.borders) {
        this.cellsBorder.drawBorders(cellRectangle.borders);
      }

      // render cell dependencies
      const dependentCells = render_dependency.getDependentsInBounds(bounds);
      if (dependentCells.length) {
        // need this to access content variable:
        // eslint-disable-next-line no-loop-func
        dependentCells.forEach((coordinate) => {
          const key = `${coordinate.x},${coordinate.y}`;
          if (renderedCells.has(key)) return;
          renderedCells.add(key);
          const entry = grid.get(coordinate.x, coordinate.y);
          if (entry) {
            const position = gridOffsets.getCell(coordinate.x, coordinate.y);
            const isInput = input && input.column === coordinate.x && input.row === coordinate.y;
            const rect = this.renderCell({ entry, ...position, isInput });
            content = content ? intersects.rectangleUnion(content, rect) : rect;
          }
        });
      }
    }

    this.labels.update();
  }

  drawCells(fullBounds: Rectangle, isQuadrant: boolean): Rectangle | undefined {
    const { grid, borders } = this.app.sheet;

    // draw cells
    const { bounds, boundsWithData } = grid.getBounds(fullBounds);
    const cellRectangle = grid.getCells(boundsWithData);
    const rectCells = this.drawBounds({ bounds, boundsWithData, cellRectangle, isQuadrant });

    // draw borders
    const borderBounds = borders.getBounds(fullBounds);
    const bordersList = borders.getBorders(borderBounds);
    const rectBorders = this.cellsBorder.drawBorders(bordersList);

    const finalBounds = intersects.rectangleUnion(rectCells, rectBorders);

    // debug boxes
    if (isQuadrant && debugShowQuadrantBoxes && finalBounds) {
      this.debug.clear();
      this.debug.beginFill(debugGetColor(), 0.25);
      this.debug.drawShape(finalBounds);
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
