import { BitmapText, Container, Graphics, Point, Rectangle } from 'pixi.js';
import { CELL_HEIGHT, CELL_WIDTH } from '../../../constants/gridConstants';
import { sheets } from '../../../grid/controller/Sheets';
import { colors } from '../../../theme/colors';
import { intersects } from '../../helpers/intersects';
import { pixiApp } from '../../pixiApp/PixiApp';
import { pixiAppSettings } from '../../pixiApp/PixiAppSettings';
import { Size } from '../../types/size';
import { calculateAlphaForGridLines } from '../gridUtils';
import { GridHeadingsLabels } from './GridHeadingsLabels';
import { getColumnA1Notation, getRowA1Notation } from './getA1Notation';

// Constants for headers
export const LABEL_MAXIMUM_WIDTH_PERCENT = 0.7;
export const LABEL_MAXIMUM_HEIGHT_PERCENT = 0.5;
export const LABEL_PADDING_ROWS = 2;
export const GRID_HEADER_FONT_SIZE = 10;
export const ROW_DIGIT_OFFSET = { x: 0, y: -1 };
const GRID_HEADING_RESIZE_TOLERANCE = 3;

// this is the number of digits to use when calculating what horizontal headings are hidden
export const LABEL_DIGITS_TO_CALCULATE_SKIP = 4;

export class GridHeadings extends Container {
  private characterSize?: Size;
  private headingsGraphics: Graphics;
  private labels: GridHeadingsLabels;
  private corner: Graphics;
  private selectedColumns: number[] = [];
  private selectedRows: number[] = [];
  private gridLinesColumns: { column: number; x: number; width: number }[] = [];
  private gridLinesRows: { row: number; y: number; height: number }[] = [];
  private rowWidth = 0;

  headingSize: Size = { width: 0, height: 0 };

  // heading location for hitTest
  private rowRect: Rectangle | undefined;
  private columnRect: Rectangle | undefined;
  private cornerRect: Rectangle | undefined;

  dirty = true;

  constructor() {
    super();
    this.headingsGraphics = this.addChild(new Graphics());
    this.labels = this.addChild(new GridHeadingsLabels());
    this.corner = this.addChild(new Graphics());
  }

  // calculates static character size (used in overlap calculations)
  private calculateCharacterSize() {
    const label = new BitmapText('X', {
      fontName: 'OpenSans',
      fontSize: GRID_HEADER_FONT_SIZE,
    });
    this.characterSize = { width: label.width, height: label.height };
  }

  private findIntervalX(i: number): number {
    if (i > 100) return 50;
    if (i > 20) return 25;
    if (i > 5) return 10;
    return 5;
  }

  private findIntervalY(i: number): number {
    if (i > 250) return 250;
    if (i > 100) return 100;
    if (i > 50) return 50;
    if (i > 25) return 25;
    if (i > 10) return 10;
    if (i > 5) return 5;
    return 5;
  }

  // creates arrays of selected columns and rows
  private createSelectedArrays(): { selectedColumns: number[]; selectedRows: number[] } {
    const cursor = sheets.sheet.cursor;
    const selectedColumns: number[] = [];
    const selectedRows: number[] = [];
    if (cursor.multiCursor) {
      for (let x = cursor.multiCursor.originPosition.x; x <= cursor.multiCursor.terminalPosition.x; x++) {
        selectedColumns.push(x);
      }
      for (let y = cursor.multiCursor.originPosition.y; y <= cursor.multiCursor.terminalPosition.y; y++) {
        selectedRows.push(y);
      }
    } else {
      selectedColumns.push(cursor.cursorPosition.x);
      selectedRows.push(cursor.cursorPosition.y);
    }
    return { selectedColumns, selectedRows };
  }

  private drawHorizontal() {
    if (!this.characterSize) return;
    const { viewport } = pixiApp;
    const showA1Notation = pixiAppSettings.showA1Notation;
    const cellWidth = CELL_WIDTH / viewport.scale.x;
    const cellHeight = CELL_HEIGHT / viewport.scale.x;
    const gridAlpha = calculateAlphaForGridLines(viewport.scale.x);
    const bounds = viewport.getVisibleBounds();
    const offsets = sheets.sheet.offsets;

    // draw horizontal bar
    this.headingsGraphics.lineStyle(0);
    this.headingsGraphics.beginFill(colors.headerBackgroundColor);
    this.columnRect = new Rectangle(viewport.left, viewport.top, viewport.right - viewport.left, cellHeight);
    this.headingsGraphics.drawShape(this.columnRect);
    this.headingsGraphics.endFill();

    // calculate selection bounds
    const selectedStart = offsets.getColumnPlacement(this.selectedColumns[0]);
    const selectedEnd = offsets.getRowPlacement(this.selectedColumns[this.selectedColumns.length - 1]);
    const xSelectedStart = selectedStart.position;
    let xSelectedEnd = xSelectedStart + selectedStart.size;
    for (let i = 1; i < this.selectedColumns.length; i++) {
      xSelectedEnd += offsets.getColumnWidth(this.selectedColumns[i]);
    }

    // use these bounds for digit overlap comparison
    const startHalfWidth =
      (this.characterSize.width * this.selectedColumns[0].toString().length) / 2 / viewport.scale.x;
    const endHalfWidth = (this.characterSize.width * this.selectedColumns[0].toString().length) / 2 / viewport.scale.x;
    const xSelectedStartLine1D = {
      start: xSelectedStart + selectedStart.size / 2 - startHalfWidth,
      end: xSelectedStart + selectedStart.size / 2 + startHalfWidth,
    };
    const xSelectedEndLine1D = {
      start: xSelectedEnd - selectedEnd.size / 2 - endHalfWidth,
      end: xSelectedEnd - selectedEnd.size / 2 + endHalfWidth,
    };

    // highlight column headings based on selected cells
    this.headingsGraphics.beginFill(colors.headerSelectedBackgroundColor);
    this.headingsGraphics.drawRect(xSelectedStart, viewport.top, xSelectedEnd - xSelectedStart, cellHeight);
    this.headingsGraphics.endFill();

    const start = offsets.getXPlacement(bounds.left);
    const end = offsets.getXPlacement(bounds.right);
    const leftOffset = start.position;
    const rightOffset = end.position + end.size;

    // labelWidth uses the constant for number of digits--this ensures the mod factor doesn't change when panning
    const labelWidth = LABEL_DIGITS_TO_CALCULATE_SKIP * this.characterSize.width;
    let mod = 0;
    if (labelWidth > CELL_WIDTH * viewport.scale.x * LABEL_MAXIMUM_WIDTH_PERCENT) {
      const skipNumbers = Math.ceil((cellWidth * (1 - LABEL_MAXIMUM_WIDTH_PERCENT)) / labelWidth);
      mod = this.findIntervalX(skipNumbers);
    }

    const y = bounds.top + cellHeight / 2.25;
    let column = start.index;
    let currentWidth = 0;
    this.gridLinesColumns = [];
    for (let x = leftOffset; x <= rightOffset; x += currentWidth) {
      currentWidth = offsets.getColumnWidth(column);
      if (gridAlpha !== 0) {
        this.headingsGraphics.lineStyle(1, colors.gridLines, 0.25 * gridAlpha, 0.5, true);
        this.headingsGraphics.moveTo(x, bounds.top);
        this.headingsGraphics.lineTo(x, bounds.top + cellHeight);
        this.gridLinesColumns.push({ column: column - 1, x, width: offsets.getColumnWidth(column - 1) });
      }

      // show first and last selected numbers unless last selected number overlaps first selected number
      const selected =
        this.selectedColumns[0] === column ||
        (this.selectedColumns.length > 1 &&
          this.selectedColumns[this.selectedColumns.length - 1] === column &&
          !intersects.lineLineOneDimension(
            xSelectedStartLine1D.start,
            xSelectedStartLine1D.end,
            xSelectedEndLine1D.start,
            xSelectedEndLine1D.end
          ));

      // only show the label if selected or mod calculation
      if (selected || mod === 0 || column % mod === 0) {
        // hide labels that are too small for the width
        // if (currentWidth > charactersWidth || this.app.gridLines.alpha === 0) {

        const charactersWidth = (this.characterSize.width * column.toString().length) / viewport.scale.x;

        // don't show numbers if it overlaps with the selected value (eg, hides 0 if selected 1 overlaps it)
        let xPosition = x + currentWidth / 2;
        const left = xPosition - charactersWidth / 2;
        const right = xPosition + charactersWidth / 2;

        // only when selected or not intersects one of the selected numbers
        if (
          selected ||
          !(
            intersects.lineLineOneDimension(xSelectedStartLine1D.start, xSelectedStartLine1D.end, left, right) ||
            intersects.lineLineOneDimension(xSelectedEndLine1D.start, xSelectedEndLine1D.end, left, right)
          )
        ) {
          const text = showA1Notation ? getColumnA1Notation(column) : column.toString();
          this.labels.add({ text, x: xPosition, y });
        }
      }
      column++;
    }
  }

  private drawVertical() {
    if (!this.characterSize) return;
    const { viewport } = pixiApp;
    const showA1Notation = pixiAppSettings.showA1Notation;
    const cellHeight = CELL_HEIGHT / viewport.scale.x;
    const gridAlpha = calculateAlphaForGridLines(viewport.scale.x);
    const bounds = viewport.getVisibleBounds();
    const offsets = sheets.sheet.offsets;

    // determine width of row header
    const start = offsets.getYPlacement(bounds.top);
    const end = offsets.getYPlacement(bounds.bottom);
    const topOffset = start.position;
    const bottomOffset = end.position + end.size;
    const topNumberLength = Math.round(topOffset / CELL_HEIGHT - 1).toString().length;
    const bottomNumberLength = Math.round(bottomOffset / CELL_HEIGHT - 1).toString().length;

    // rowWidth is the maximum number of digits of the top number and bottom number * characterSize.width
    this.rowWidth =
      (Math.max(topNumberLength, bottomNumberLength) * this.characterSize.width) / viewport.scale.x +
      (LABEL_PADDING_ROWS / viewport.scale.x) * 2;
    this.rowWidth = Math.max(this.rowWidth, CELL_HEIGHT / viewport.scale.x);

    // draw vertical bar
    this.headingsGraphics.lineStyle(0);
    this.headingsGraphics.beginFill(colors.headerBackgroundColor);
    const top = bounds.top + cellHeight;
    const bottom = bounds.height - cellHeight;
    this.rowRect = new Rectangle(bounds.left, top, this.rowWidth, bottom);
    this.headingsGraphics.drawShape(this.rowRect);
    this.headingsGraphics.endFill();

    // calculated selection bounds
    const selectedStart = offsets.getRowPlacement(this.selectedRows[0]);
    const selectedEnd = offsets.getRowPlacement(this.selectedRows[this.selectedRows.length - 1]);
    const ySelectedStart = selectedStart.position;
    let ySelectedEnd = ySelectedStart + selectedStart.size;
    for (let i = 1; i < this.selectedRows.length; i++) {
      ySelectedEnd += offsets.getRowHeight(this.selectedRows[i]);
    }
    const halfCharacterHeight = this.characterSize.height / 2 / viewport.scale.x;

    // use these bounds for digit overlap comparison
    const ySelectedStartLine1D = {
      start: ySelectedStart + selectedStart.size / 2 - halfCharacterHeight,
      end: ySelectedStart + selectedStart.size / 2 + halfCharacterHeight,
    };
    const ySelectedEndLine1D = {
      start: ySelectedEnd - selectedEnd.size / 2 - halfCharacterHeight,
      end: ySelectedEnd - selectedEnd.size / 2 + halfCharacterHeight,
    };

    // highlight row headings based on selected cells
    this.headingsGraphics.beginFill(colors.headerSelectedBackgroundColor);
    this.headingsGraphics.drawRect(viewport.left, ySelectedStart, this.rowWidth, ySelectedEnd - ySelectedStart);
    this.headingsGraphics.endFill();

    let mod = 0;
    if (this.characterSize.height > CELL_HEIGHT * viewport.scale.y * LABEL_MAXIMUM_HEIGHT_PERCENT) {
      const skipNumbers = Math.ceil((cellHeight * (1 - LABEL_MAXIMUM_HEIGHT_PERCENT)) / this.characterSize.height);
      mod = this.findIntervalY(skipNumbers);
    }

    const x = bounds.left + this.rowWidth / 2;
    let row = start.index;
    let currentHeight = 0;
    this.gridLinesRows = [];
    for (let y = topOffset; y <= bottomOffset; y += currentHeight) {
      currentHeight = offsets.getRowHeight(row);
      if (gridAlpha !== 0) {
        this.headingsGraphics.lineStyle(1, colors.gridLines, 0.25 * gridAlpha, 0.5, true);
        this.headingsGraphics.moveTo(bounds.left, y);
        this.headingsGraphics.lineTo(bounds.left + this.rowWidth, y);
        this.gridLinesRows.push({ row: row - 1, y, height: offsets.getRowHeight(row - 1) });
      }

      // show first and last selected numbers unless last selected number overlaps first selected number
      const selected =
        this.selectedRows[0] === row ||
        (this.selectedRows.length > 1 &&
          this.selectedRows[this.selectedRows.length - 1] === row &&
          !intersects.lineLineOneDimension(
            ySelectedStartLine1D.start,
            ySelectedStartLine1D.end,
            ySelectedEndLine1D.start,
            ySelectedEndLine1D.end
          ));

      // only show the label if selected or mod calculation
      if (selected || mod === 0 || row % mod === 0) {
        // only show labels if height is large enough
        // if (currentHeight > halfCharacterHeight * 2 || this.app.gridLines.alpha === 0) {

        // don't show numbers if it overlaps with the selected value (eg, allows digit 1 to show if it overlaps digit 0)
        let yPosition = y + currentHeight / 2;
        const top = yPosition - halfCharacterHeight;
        const bottom = yPosition + halfCharacterHeight;
        if (
          selected ||
          !(
            intersects.lineLineOneDimension(ySelectedStartLine1D.start, ySelectedStartLine1D.end, top, bottom) ||
            intersects.lineLineOneDimension(ySelectedEndLine1D.start, ySelectedEndLine1D.end, top, bottom)
          )
        ) {
          const text = showA1Notation ? getRowA1Notation(row) : row.toString();
          this.labels.add({ text, x: x + ROW_DIGIT_OFFSET.x, y: yPosition + ROW_DIGIT_OFFSET.y });
        }
      }
      row++;

      // uncomment this code for a target to find the ROW_DIGIT_OFFSET for centering the row numbers
      // graphics.lineStyle(1, 0, 0.5)
      // graphics.moveTo(bounds.left, y)
      // graphics.lineTo(bounds.left + rowWidth, y)
      // graphics.moveTo(bounds.left + rowWidth / 2, y)
      // graphics.lineTo(bounds.left + rowWidth / 2, y + CELL_HEIGHT)
    }
  }

  private drawCorner(): void {
    const { viewport } = pixiApp;
    const bounds = viewport.getVisibleBounds();
    const cellHeight = CELL_HEIGHT / viewport.scale.x;
    this.corner.clear();
    this.corner.beginFill(colors.headerCornerBackgroundColor);
    this.cornerRect = new Rectangle(bounds.left, bounds.top, this.rowWidth, cellHeight);
    this.corner.drawShape(this.cornerRect);
    this.corner.endFill();
  }

  private drawHeadingLines(): void {
    const { viewport } = pixiApp;
    const cellHeight = CELL_HEIGHT / viewport.scale.x;
    const bounds = viewport.getVisibleBounds();
    this.headingsGraphics.lineStyle(1, colors.gridLines, 0.25, 0.5, true);
    this.headingsGraphics.moveTo(bounds.left + this.rowWidth, viewport.top);
    this.headingsGraphics.lineTo(bounds.left + this.rowWidth, viewport.bottom);
    this.headingsGraphics.moveTo(bounds.left, bounds.top + cellHeight);
    this.headingsGraphics.lineTo(bounds.right, bounds.top + cellHeight);
  }

  update() {
    if (!this.dirty) return;
    this.dirty = false;
    const { selectedColumns, selectedRows } = this.createSelectedArrays();
    this.labels.clear();
    this.selectedColumns = selectedColumns;
    this.selectedRows = selectedRows;

    this.headingsGraphics.clear();

    if (!pixiAppSettings.showHeadings) {
      this.visible = false;
      this.rowRect = undefined;
      this.columnRect = undefined;
      this.headingSize = { width: 0, height: 0 };
      window.dispatchEvent(new CustomEvent('heading-size', { detail: this.headingSize }));
      pixiApp.setViewportDirty();
      return;
    }
    this.visible = true;
    if (!this.characterSize) {
      this.calculateCharacterSize();
    }

    this.drawVertical();
    this.drawHorizontal();
    this.drawHeadingLines();
    this.labels.update();
    this.drawCorner();

    this.headingSize = { width: this.rowWidth * pixiApp.viewport.scale.x, height: CELL_HEIGHT };
    window.dispatchEvent(new CustomEvent('heading-size', { detail: this.headingSize }));
  }

  // whether the point is in the heading
  intersectsHeadings(world: Point): { column?: number; row?: number; corner?: true } | undefined {
    if (!this.columnRect || !this.rowRect || !this.cornerRect) return;
    const offsets = sheets.sheet.offsets;

    if (intersects.rectanglePoint(this.cornerRect, world)) {
      return { corner: true };
    }
    if (intersects.rectanglePoint(this.columnRect, world)) {
      return { column: offsets.getXPlacement(world.x).index };
    }
    if (intersects.rectanglePoint(this.rowRect, world)) {
      return { row: offsets.getYPlacement(world.y).index };
    }
  }

  // whether the point is on the heading gridLine (with tolerance)
  intersectsHeadingGridLine(
    world: Point
  ): { start: number; column?: number; row?: number; width?: number; height?: number } | undefined {
    const offsets = sheets.sheet.offsets;
    const tolerance = GRID_HEADING_RESIZE_TOLERANCE / pixiApp.viewport.scale.x;
    if (!this.columnRect || !this.rowRect) return;
    if (intersects.rectanglePoint(this.columnRect, world)) {
      for (const line of this.gridLinesColumns) {
        if (Math.abs(world.x - line.x) < tolerance) {
          const start = offsets.getColumnPlacement(line.column);
          return { start: start.position, column: line.column, width: line.width };
        }
      }
    }

    // todo: disabled until we support wrapping
    /*
    if (intersects.rectanglePoint(this.rowRect, world)) {
      for (const line of this.gridLinesRows) {
        if (Math.abs(world.y - line.y) < tolerance) {
          const start = offsets.getRowPlacement(sheetId, line.row);
          return { start: start.position, row: line.row, height: line.height };
        }
      }
    }
    */
  }
}
