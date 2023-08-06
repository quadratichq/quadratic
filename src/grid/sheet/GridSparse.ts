import { Rectangle } from 'pixi.js';
import { CellFill, CellRust } from '../../gridGL/cells/CellsTypes';
import { pixiAppEvents } from '../../gridGL/pixiApp/PixiAppEvents';
import { Quadrants } from '../../gridGL/quadrants/Quadrants';
import { Coordinate, MinMax } from '../../gridGL/types/size';
import { Grid, Pos, Rect, SheetId } from '../../quadratic-core/quadratic_core';
import { Cell, CellFormat } from '../../schemas';
import { CellRectangle } from './CellRectangle';
import { GridOffsets } from './GridOffsets';
import { Sheet } from './Sheet';

export interface CellAndFormat {
  cell?: Cell;
  format?: CellFormat;
}

/** Stores all cells and format locations */
export class GridSparse {
  private sheet: Sheet;
  private grid: Grid;

  sheetId: SheetId;

  // tracks which quadrants need to render based on GridSparse data
  quadrants = new Set<string>();

  constructor(grid: Grid, index: number, sheet: Sheet) {
    this.sheet = sheet;
    this.grid = grid;

    const sheetId = this.grid.sheetIndexToId(index);
    if (!sheetId) throw new Error('Expected sheetId to be defined');
    this.sheetId = sheetId;
  }

  get gridOffsets(): GridOffsets {
    return this.sheet.gridOffsets;
  }

  updateCells(cells: Cell[], skipBounds = false): void {
    cells.forEach((cell) => {
      if (cell.type === 'TEXT') {
        this.grid.setCellValue(this.sheetId, new Pos(cell.x, cell.y), { type: 'text', value: cell.value });
      } else {
        debugger;
      }
      this.quadrants.add(Quadrants.getKey(cell.x, cell.y));
    });
    if (!skipBounds) {
      this.grid.recalculateBounds(this.sheetId);
    }

    pixiAppEvents.changeCells(
      this.sheet,
      cells.map((cell) => ({ x: cell.x, y: cell.y })),
      { labels: true }
    );
  }

  hasFormatting(format: CellFormat): boolean {
    const keys = Object.keys(format);
    return keys.length > 2;
  }

  // todo: this should be separated into its components
  updateFormat(formats: CellFormat[], skipBounds = false): void {
    formats.forEach((format) => {
      const region = new Rect(new Pos(format.x, format.y), new Pos(format.x, format.y));
      const originalRange = this.grid.getRenderCells(this.sheetId, region);
      const original = JSON.parse(originalRange)?.[0] ?? {};
      if (this.hasFormatting(format)) {
        if (format.bold !== undefined && format.bold !== original.bold) {
          this.grid.setCellBold(this.sheetId, region, !!format.bold);
        }
        if (format.italic !== undefined && format.italic !== original.italic) {
          this.grid.setCellItalic(this.sheetId, region, !!format.italic);
        }
        if (format.alignment !== undefined && format.alignment !== original.align) {
          this.grid.setCellAlign(this.sheetId, region, format.alignment);
        }
        if (format.fillColor !== undefined && format.fillColor !== original.fillColor) {
          this.grid.setCellFillColor(this.sheetId, region, format.fillColor);
        }
        if (format.textColor !== undefined && format.textColor !== original.textColor) {
          this.grid.setCellTextColor(this.sheetId, region, format.textColor);
        }
        if (format.textFormat !== undefined && format.textFormat !== original.textFormat) {
          this.grid.setCellNumericFormat(this.sheetId, region, format.textFormat);
        }
        if (format.wrapping !== undefined && format.wrapping !== original.wrapping) {
          this.grid.setCellWrap(this.sheetId, region, format.textFormat);
        }
      } else {
        this.grid.clearFormatting(this.sheetId, region);
      }
      this.quadrants.add(Quadrants.getKey(format.x, format.y));
    });
    if (!skipBounds) {
      this.grid.recalculateBounds(this.sheetId);
    }
    pixiAppEvents.changeCells(
      this.sheet,
      formats.map((format) => ({ x: format.x, y: format.y })),
      { labels: true }
    );
  }

  clearFormat(formats: CellFormat[], skipBounds = false): void {
    formats.forEach((format) => {
      const region = new Rect(new Pos(format.x, format.y), new Pos(format.x, format.y));
      this.grid.clearFormatting(this.sheetId, region);
    });
    if (!skipBounds) {
      this.grid.recalculateBounds(this.sheetId);
    }
  }

  deleteCells(cells: Coordinate[], skipBounds = false): void {
    cells.forEach((cell) => {
      const region = new Rect(new Pos(cell.x, cell.y), new Pos(cell.x, cell.y));
      this.grid.deleteCellValues(this.sheetId, region);
    });
    if (!skipBounds) {
      this.grid.recalculateBounds(this.sheetId);
    }
  }

  get empty(): boolean {
    const bounds = this.grid.getGridBounds(this.sheetId, false);
    return bounds.width === 0 && bounds.height === 0;
  }

  clear() {
    // this.cells.clear();
    // this.quadrants.clear();
    // this.cellBounds.clear();
    // this.formatBounds.clear();
    // this.cellFormatBounds.clear();
  }

  get(x: number, y: number): CellAndFormat | undefined {
    const json = this.grid.getRenderCells(this.sheetId, new Rect(new Pos(x, y), new Pos(x, y)));
    const data = JSON.parse(json);
    if (data.length) {
      return {
        cell: {
          x,
          y,
          value: data[0].value.toString(),
          type: 'TEXT',
        },
        format: {
          x,
          y,
          bold: data[0].bold,
          italic: data[0].italic,
          alignment: data[0].align,
          fillColor: data[0].fillColor,
          textColor: data[0].textColor,
          textFormat: data[0].textFormat,
          wrapping: data[0].wrapping,
        },
      };
    }
  }

  getCell(x: number, y: number): Cell | undefined {
    const json = this.grid.getRenderCells(this.sheetId, new Rect(new Pos(x, y), new Pos(x, y)));
    const data = JSON.parse(json);
    return {
      x,
      y,
      value: data[0].value.toString(),
      type: 'TEXT',
    };
  }

  getFormat(x: number, y: number): CellFormat | undefined {
    const json = this.grid.getRenderCells(this.sheetId, new Rect(new Pos(x, y), new Pos(x, y)));
    const data = JSON.parse(json);
    if (!data[0]) return;
    return {
      x,
      y,
      bold: data[0].bold,
      italic: data[0].italic,
      alignment: data[0].align,
      fillColor: data[0].fillColor,
      textColor: data[0].textColor,
      textFormat: data[0].textFormat,
      wrapping: data[0].wrapping,
    };
  }

  getCellList(rectangle: Rectangle): CellRust[] {
    const rect = new Rect(new Pos(rectangle.left, rectangle.top), new Pos(rectangle.right, rectangle.bottom));
    const cells = this.grid.getRenderCells(this.sheetId, rect);
    return JSON.parse(cells);
  }

  getCellBackground(rectangle: Rectangle): CellFill[] {
    const rect = new Rect(new Pos(rectangle.left, rectangle.top), new Pos(rectangle.right, rectangle.bottom));
    const background = this.grid.getRenderFills(this.sheetId, rect);
    return JSON.parse(background);
  }

  getCells(rectangle: Rectangle): CellRectangle {
    const rect = new Rect(new Pos(rectangle.x, rectangle.y), new Pos(rectangle.right, rectangle.bottom));
    const data = this.grid.getRenderCells(this.sheetId, rect);
    return CellRectangle.fromRust(rectangle, data, this);
  }

  getNakedCells(x0: number, y0: number, x1: number, y1: number): Cell[] {
    const json = this.grid.getRenderCells(this.sheetId, new Rect(new Pos(x0, y0), new Pos(x1, y1)));
    const data = JSON.parse(json);
    const cells: Cell[] = [];
    data.forEach((entry: any) => {
      if (entry.x >= x0 && entry.x <= x1 && entry.y >= y0 && entry.y <= y1) {
        cells.push({
          x: entry.x,
          y: entry.y,
          type: 'TEXT',
          value: entry.value,
        });
      }
    });
    return cells;
  }

  getNakedFormat(x0: number, y0: number, x1: number, y1: number): CellFormat[] {
    const json = this.grid.getRenderCells(this.sheetId, new Rect(new Pos(x0, y0), new Pos(x1, y1)));
    const data = JSON.parse(json);
    const cells: CellFormat[] = [];
    data.forEach((entry: any) => {
      if (entry.x >= x0 && entry.x <= x1 && entry.y >= y0 && entry.y <= y1) {
        cells.push({
          x: entry.x,
          y: entry.y,
          bold: entry.bold,
          italic: entry.italic,
          alignment: entry.align,
          fillColor: entry.fillColor,
          textColor: entry.textColor,
          textFormat: entry.textFormat,
          wrapping: entry.wrapping,
        });
      }
    });
    return cells;
  }

  getBounds(bounds: Rectangle): { bounds: Rectangle; boundsWithData: Rectangle | undefined } {
    const allBounds = this.grid.getGridBounds(this.sheetId, false);
    const minX = allBounds.nonEmpty?.min.x;
    const minY = allBounds.nonEmpty?.min.y;
    const maxX = allBounds.nonEmpty?.max.x;
    const maxY = allBounds.nonEmpty?.max.y;
    const empty = !allBounds.nonEmpty;
    const columnStartIndex = this.gridOffsets.getColumnIndex(bounds.left);
    const columnStart = columnStartIndex.index > minX ? columnStartIndex.index : minX;
    const columnEndIndex = this.gridOffsets.getColumnIndex(bounds.right);
    const columnEnd = columnEndIndex.index < maxX ? columnEndIndex.index : maxX;

    const rowStartIndex = this.gridOffsets.getRowIndex(bounds.top);
    const rowStart = rowStartIndex.index > minY ? rowStartIndex.index : minY;
    const rowEndIndex = this.gridOffsets.getRowIndex(bounds.bottom);
    const rowEnd = rowEndIndex.index < maxY ? rowEndIndex.index : maxY;

    return {
      bounds: new Rectangle(
        columnStartIndex.index,
        rowStartIndex.index,
        columnEndIndex.index - columnStartIndex.index,
        rowEndIndex.index - rowStartIndex.index
      ),
      boundsWithData: empty
        ? undefined
        : new Rectangle(columnStart, rowStart, columnEnd - columnStart, rowEnd - rowStart),
    };
  }

  getGridBounds(onlyData: boolean): Rectangle | undefined {
    const bounds = this.grid.getGridBounds(this.sheetId, onlyData);
    if (bounds.nonEmpty) {
      return new Rectangle(
        bounds.nonEmpty.min.x,
        bounds.nonEmpty.min.y,
        bounds.nonEmpty.max.x - bounds.nonEmpty.min.x,
        bounds.nonEmpty.max.y - bounds.nonEmpty.min.y
      );
    }
  }

  /** finds the minimum and maximum location for content in a row */
  getRowMinMax(row: number, onlyData: boolean): MinMax | undefined {
    // const { minX, maxX, empty } = this.cellFormatBounds;
    // if (empty) return;
    // let min = Infinity;
    // let max = -Infinity;
    // for (let x = minX; x <= maxX; x++) {
    //   const entry = this.get(x, row);
    //   if (entry && ((onlyData && entry.cell) || (!onlyData && entry))) {
    //     min = x;
    //     break;
    //   }
    // }
    // for (let x = maxX; x >= minX; x--) {
    //   const entry = this.get(x, row);
    //   if (entry && ((onlyData && entry.cell) || (!onlyData && entry))) {
    //     max = x;
    //     break;
    //   }
    // }
    // if (min === Infinity) return;
    // return { min, max };
    return;
  }

  /**finds the minimum and maximum location for content in a column */
  getColumnMinMax(column: number, onlyData: boolean): MinMax | undefined {
    // const { minY, maxY, empty } = this.cellFormatBounds;
    // if (empty) return;
    // let min = Infinity;
    // let max = -Infinity;
    // for (let y = minY; y <= maxY; y++) {
    //   const entry = this.get(column, y);
    //   if (entry && ((onlyData && entry.cell) || (!onlyData && entry))) {
    //     min = y;
    //     break;
    //   }
    // }
    // for (let y = maxY; y >= minY; y--) {
    //   const entry = this.get(column, y);
    //   if (entry && ((onlyData && entry.cell) || (!onlyData && entry))) {
    //     max = y;
    //     break;
    //   }
    // }
    // if (min === Infinity) return;
    // return { min, max };
    return;
  }

  hasQuadrant(x: number, y: number): boolean {
    return this.quadrants.has(Quadrants.getKey(x, y));
  }

  /**
   * finds the next column with or without content
   * @param options
   * @param xStart where to start looking
   * @param y the row to look in
   * @param delta 1 or -1
   * @param withContent if true, will find the next column with content, if false, will find the next column without content
   * @returns the found column or the original column if nothing was found
   */
  findNextColumn(options: { xStart: number; y: number; delta: 1 | -1; withContent: boolean }): number {
    // const { xStart, delta, y, withContent } = options;
    // const bounds = this.cellBounds;
    // if (!bounds) return xStart;
    // let x = delta === 1 ? Math.max(xStart, bounds.minX) : Math.min(xStart, bounds.maxX);

    // // -1 and +1 are to cover where the cell at the bounds should be returned
    // while (x >= bounds.minX - 1 && x <= bounds.maxX + 1) {
    //   const hasContent = cellHasContent(this.get(x, y)?.cell);
    //   if ((withContent && hasContent) || (!withContent && !hasContent)) {
    //     return x;
    //   }
    //   x += delta;
    // }
    // return xStart;
    return 0;
  }

  /**
   * finds the next row with or without content
   * @param options
   * @param yStart where to start looking
   * @param x the column to look in
   * @param delta 1 or -1
   * @param withContent if true, will find the next column with content, if false, will find the next column without content
   * @returns the found row or the original row if nothing was found
   */
  findNextRow(options: { yStart: number; x: number; delta: 1 | -1; withContent: boolean }): number {
    // const { yStart, delta, x, withContent } = options;
    // const bounds = this.cellBounds;
    // if (!bounds) return yStart;
    // let y = delta === 1 ? Math.max(yStart, bounds.minY) : Math.min(yStart, bounds.maxY);

    // // -1 and +1 are to cover where the cell at the bounds should be returned
    // while (y >= bounds.minY - 1 && y <= bounds.maxY + 1) {
    //   const hasContent = cellHasContent(this.get(x, y)?.cell);
    //   if ((withContent && hasContent) || (!withContent && !hasContent)) {
    //     return y;
    //   }
    //   y += delta;
    // }
    // return yStart;
    return 0;
  }

  recalculateBounds(): void {
    this.grid.recalculateBounds(this.sheetId);
  }
}
