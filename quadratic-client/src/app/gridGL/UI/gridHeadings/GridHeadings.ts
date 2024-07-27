import { BitmapText, Container, Graphics, Rectangle } from 'pixi.js';
import type { Point } from 'pixi.js';

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type { Size } from '@/app/gridGL/types/size';
import { getColumnA1Notation } from '@/app/gridGL/UI/gridHeadings/getA1Notation';
import { GridHeadingsLabels } from '@/app/gridGL/UI/gridHeadings/GridHeadingsLabels';
import { calculateAlphaForGridLines } from '@/app/gridGL/UI/gridUtils';
import { colors } from '@/app/theme/colors';
import { CELL_HEIGHT, CELL_WIDTH } from '@/shared/constants/gridConstants';

type Selected = 'all' | number[] | undefined;

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
  private selectedColumns: Selected;
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

  // Fills horizontal bar based on selection.
  private drawHorizontalBar() {
    const viewport = pixiApp.viewport;
    const bounds = viewport.getVisibleBounds();
    const scale = viewport.scaled;
    const cellHeight = CELL_HEIGHT / scale;
    const offsets = sheets.sheet.offsets;
    const cursor = sheets.sheet.cursor;

    this.headingsGraphics.lineStyle(0);
    this.headingsGraphics.beginFill(colors.headerBackgroundColor);
    this.columnRect = new Rectangle(bounds.left, bounds.top, bounds.width, cellHeight);
    this.headingsGraphics.drawShape(this.columnRect);
    this.headingsGraphics.endFill();

    // fill the entire viewport if all cells are selected
    if (cursor.columnRow?.all) {
      this.headingsGraphics.beginFill(colors.headerSelectedRowColumnBackgroundColor);
      this.headingsGraphics.drawRect(viewport.left, viewport.top, viewport.screenWidthInWorldPixels, cellHeight);
      this.headingsGraphics.endFill();
      return 'all';
    }

    // dark fill headings if there is a columnRow selection
    if (cursor.columnRow?.columns) {
      this.headingsGraphics.beginFill(colors.headerSelectedRowColumnBackgroundColor);
      cursor.columnRow.columns.forEach((column) => {
        const offset = offsets.getColumnPlacement(column);
        this.headingsGraphics.drawRect(offset.position, viewport.top, offset.size, cellHeight);
      });
      this.headingsGraphics.endFill();
      return cursor.columnRow.columns;
    }

    // if we're selecting rows, then show all columns as selected
    if (cursor.columnRow?.rows) {
      this.headingsGraphics.beginFill(colors.headerSelectedBackgroundColor);
      this.headingsGraphics.drawRect(viewport.left, viewport.top, viewport.screenWidthInWorldPixels, cellHeight);
      this.headingsGraphics.endFill();
      return 'all';
    }

    // selected cells based on multiCursor
    else if (cursor.multiCursor) {
      const selectedColumns = new Set<number>();
      this.headingsGraphics.beginFill(colors.headerSelectedBackgroundColor);
      cursor.multiCursor.forEach((rectangle) => {
        const start = offsets.getColumnPlacement(rectangle.left);
        const end = offsets.getColumnPlacement(rectangle.right - 1);
        this.headingsGraphics.drawRect(
          start.position,
          viewport.top,
          end.position + end.size - start.position,
          cellHeight
        );
        for (let x = rectangle.left; x < rectangle.right; x++) {
          selectedColumns.add(x);
        }
      });
      this.headingsGraphics.endFill();
      this.selectedColumns = Array.from(selectedColumns);
    }

    // otherwise selected cursor is cursorPosition
    else {
      const offset = offsets.getColumnPlacement(cursor.cursorPosition.x);
      this.headingsGraphics.beginFill(colors.headerSelectedBackgroundColor);
      this.headingsGraphics.drawRect(offset.position, viewport.top, offset.size, cellHeight);
      this.headingsGraphics.endFill();
      this.selectedColumns = [cursor.cursorPosition.x];
    }
  }

  // Adds horizontal labels
  private horizontalLabels() {
    if (!this.characterSize) return;

    const viewport = pixiApp.viewport;
    const scale = viewport.scaled;
    const bounds = viewport.getVisibleBounds();
    const offsets = sheets.sheet.offsets;
    const cellWidth = CELL_WIDTH / scale;
    const cellHeight = CELL_HEIGHT / scale;
    const gridAlpha = calculateAlphaForGridLines(scale);
    const showA1Notation = pixiAppSettings.showA1Notation;

    const start = offsets.getXPlacement(bounds.left);
    const end = offsets.getXPlacement(bounds.right);
    const leftOffset = start.position;
    const rightOffset = end.position + end.size;

    // labelWidth uses the constant for number of digits--this ensures the mod factor doesn't change when panning
    const labelWidth = LABEL_DIGITS_TO_CALCULATE_SKIP * this.characterSize.width;
    let mod = 0;
    if (labelWidth > CELL_WIDTH * scale * LABEL_MAXIMUM_WIDTH_PERCENT) {
      const skipNumbers = Math.ceil((cellWidth * (1 - LABEL_MAXIMUM_WIDTH_PERCENT)) / labelWidth);
      mod = this.findIntervalX(skipNumbers);
    }

    const y = bounds.top + cellHeight / 2.25;
    let column = start.index;
    let currentWidth = 0;
    this.gridLinesColumns = [];

    // keep track of last label to ensure we don't overlap
    let lastLabel: { left: number; right: number; selected: boolean } | undefined = undefined;

    for (let x = leftOffset; x <= rightOffset; x += currentWidth) {
      currentWidth = offsets.getColumnWidth(column);
      if (gridAlpha !== 0) {
        this.headingsGraphics.lineStyle(1, colors.gridLines, 0.25 * gridAlpha, 0.5, true);
        this.headingsGraphics.moveTo(x, bounds.top);
        this.headingsGraphics.lineTo(x, bounds.top + cellHeight);
        this.gridLinesColumns.push({ column: column - 1, x, width: offsets.getColumnWidth(column - 1) });
      }

      // show selected numbers
      const selected = Array.isArray(this.selectedColumns) ? this.selectedColumns.includes(column) : false;

      // only show the label if selected or mod calculation
      if (selected || mod === 0 || column % mod === 0) {
        const charactersWidth = (this.characterSize.width * column.toString().length) / scale;

        // only show labels that will fit (unless grid lines are hidden)
        if (currentWidth > charactersWidth || pixiApp.gridLines.alpha < 0.25) {
          // don't show numbers if it overlaps with the selected value (eg, hides 0 if selected 1 overlaps it)
          let xPosition = x + currentWidth / 2;
          const left = xPosition - charactersWidth / 2;
          const right = xPosition + charactersWidth / 2;

          // we remove the last label if we're intersecting and it was not
          // selected but we are selected. We also leave first and last
          // selections, unless there is only two selections, in which case we
          // leave only the first.
          let intersectsLast =
            lastLabel && intersects.lineLineOneDimension(lastLabel.left, lastLabel.right, left, right);
          const selectedColumns = Array.isArray(this.selectedColumns) ? [...this.selectedColumns] : [];
          if (
            intersectsLast &&
            selected &&
            (!selectedColumns.includes(column - 1) || !selectedColumns.includes(column + 1)) &&
            (selectedColumns.includes(column - 2) || selectedColumns.includes(column + 2))
          ) {
            this.labels.removeLast();
            intersectsLast = false;
          }

          // show only when selected or not intersects one of the selected numbers
          if (!intersectsLast) {
            const text = showA1Notation ? getColumnA1Notation(column) : column.toString();
            this.labels.add({ text, x: xPosition, y });
            lastLabel = { left, right, selected };
          }
        }
      }
      column++;
    }
  }

  private drawHorizontal() {
    this.drawHorizontalBar();
    this.horizontalLabels();
  }

  private drawVerticalBar() {
    if (!this.characterSize) return;

    const viewport = pixiApp.viewport;
    const bounds = viewport.getVisibleBounds();
    const offsets = sheets.sheet.offsets;
    const cursor = sheets.sheet.cursor;

    const start = offsets.getYPlacement(bounds.top);
    const end = offsets.getYPlacement(bounds.bottom);
    const topOffset = start.position;
    const bottomOffset = end.position + end.size;
    const topNumberLength = Math.round(topOffset / CELL_HEIGHT - 1).toString().length;
    const bottomNumberLength = Math.round(bottomOffset / CELL_HEIGHT - 1).toString().length;

    this.rowWidth =
      (Math.max(topNumberLength, bottomNumberLength) * this.characterSize.width) / viewport.scale.x +
      (LABEL_PADDING_ROWS / viewport.scale.x) * 2;
    this.rowWidth = Math.max(this.rowWidth, CELL_HEIGHT / viewport.scale.x);

    // draw background of vertical bar
    this.headingsGraphics.lineStyle(0);
    this.headingsGraphics.beginFill(colors.headerBackgroundColor);
    this.columnRect = new Rectangle(bounds.left, bounds.top, this.rowWidth, bounds.height);
    this.headingsGraphics.drawShape(this.columnRect);
    this.headingsGraphics.endFill();
    this.rowRect = new Rectangle(bounds.left, bounds.top, this.rowWidth, bounds.height);

    // fill the entire viewport if all cells are selected
    if (cursor.columnRow?.all) {
      this.headingsGraphics.beginFill(colors.headerSelectedRowColumnBackgroundColor);
      this.headingsGraphics.drawRect(bounds.left, bounds.top, this.rowWidth, bounds.height);
      this.headingsGraphics.endFill();
    }

    // dark fill headings if there is a columnRow selection
    if (cursor.columnRow?.rows) {
      this.headingsGraphics.beginFill(colors.headerSelectedRowColumnBackgroundColor);
      cursor.columnRow.rows.forEach((row) => {
        const offset = offsets.getRowPlacement(row);
        this.headingsGraphics.drawRect(bounds.left, offset.position, this.rowWidth, offset.size);
      });
      this.headingsGraphics.endFill();
    }

    // if we're selecting columns, then show all rows as selected
    if (cursor.columnRow?.columns) {
      this.headingsGraphics.beginFill(colors.headerSelectedBackgroundColor);
      this.headingsGraphics.drawRect(bounds.left, bounds.top, this.rowWidth, bounds.height);
      this.headingsGraphics.endFill();
    }

    // selected cells based on multiCursor
    if (cursor.multiCursor) {
      const selectedRows = new Set<number>();
      this.headingsGraphics.beginFill(colors.headerSelectedBackgroundColor);
      cursor.multiCursor.forEach((rectangle) => {
        const start = offsets.getRowPlacement(rectangle.top);
        const end = offsets.getRowPlacement(rectangle.bottom - 1);
        this.headingsGraphics.drawRect(
          bounds.left,
          start.position,
          this.rowWidth,
          end.position + end.size - start.position
        );
        for (let y = rectangle.top; y < rectangle.bottom; y++) {
          selectedRows.add(y);
        }
      });
      this.headingsGraphics.endFill();
      this.selectedRows = Array.from(selectedRows);
    }

    // otherwise selected cursor is cursorPosition
    if (!cursor.multiCursor && !cursor.columnRow) {
      const offset = offsets.getRowPlacement(cursor.cursorPosition.y);
      this.headingsGraphics.beginFill(colors.headerSelectedBackgroundColor);
      this.headingsGraphics.drawRect(bounds.left, offset.position, this.rowWidth, offset.size);
      this.headingsGraphics.endFill();
      this.selectedRows = [cursor.cursorPosition.y];
    }
  }

  private verticalLabels() {
    if (!this.characterSize) return;

    const viewport = pixiApp.viewport;
    const scale = viewport.scaled;
    const bounds = viewport.getVisibleBounds();
    const offsets = sheets.sheet.offsets;
    const cellHeight = CELL_HEIGHT / scale;

    const gridAlpha = calculateAlphaForGridLines(scale);

    const start = offsets.getYPlacement(bounds.top);
    const end = offsets.getYPlacement(bounds.bottom);
    const topOffset = start.position;
    const bottomOffset = end.position + end.size;

    // labelWidth uses the constant for number of digits--this ensures the mod factor doesn't change when panning
    let mod = 0;
    if (this.characterSize.height > CELL_HEIGHT * scale * LABEL_MAXIMUM_HEIGHT_PERCENT) {
      const skipNumbers = Math.ceil((cellHeight * (1 - LABEL_MAXIMUM_HEIGHT_PERCENT)) / this.characterSize.height);
      mod = this.findIntervalY(skipNumbers);
    }

    const x = bounds.left + this.rowWidth / 2;
    let row = start.index;
    let currentHeight = 0;
    this.gridLinesColumns = [];

    // keep track of last label to ensure we don't overlap
    let lastLabel: { top: number; bottom: number; selected: boolean } | undefined = undefined;

    const halfCharacterHeight = this.characterSize.height / scale;

    for (let y = topOffset; y <= bottomOffset; y += currentHeight) {
      currentHeight = offsets.getRowHeight(row);
      if (gridAlpha !== 0) {
        this.headingsGraphics.lineStyle(1, colors.gridLines, 0.25 * gridAlpha, 0.5, true);
        this.headingsGraphics.moveTo(bounds.left, y);
        this.headingsGraphics.lineTo(bounds.left + this.rowWidth, y);
        this.gridLinesRows.push({ row: row - 1, y, height: offsets.getRowHeight(row - 1) });
      }

      // show selected numbers
      const selected = Array.isArray(this.selectedRows) ? this.selectedRows.includes(row) : false;

      // only show the label if selected or mod calculation
      if (selected || mod === 0 || row % mod === 0) {
        // only show labels that will fit (unless grid lines are hidden)
        // if (currentHeight > halfCharacterHeight * 2 || pixiApp.gridLines.alpha < 0.25) {
        // don't show numbers if it overlaps with the selected value (eg, hides 0 if selected 1 overlaps it)
        let yPosition = y + currentHeight / 2;
        const top = yPosition - halfCharacterHeight / 2;
        const bottom = yPosition + halfCharacterHeight / 2;

        // We remove the last label if we're intersecting and it was not
        // selected but we are selected. We also leave first and last
        // selections, unless there is only two selections, in which case we
        // leave only the first.
        let intersectsLast = lastLabel && intersects.lineLineOneDimension(lastLabel.top, lastLabel.bottom, top, bottom);
        const selectedRows = Array.isArray(this.selectedRows) ? [...this.selectedRows] : [];
        if (
          intersectsLast &&
          selected &&
          (!selectedRows.includes(row - 1) || !selectedRows.includes(row + 1)) &&
          (selectedRows.includes(row - 2) || selectedRows.includes(row + 2))
        ) {
          this.labels.removeLast();
          intersectsLast = false;
        }

        // show only when selected or not intersects one of the selected numbers
        if (!intersectsLast) {
          const text = row.toString();
          this.labels.add({ text, x: x + ROW_DIGIT_OFFSET.x, y: yPosition + ROW_DIGIT_OFFSET.y });
          lastLabel = { top, bottom, selected };
        }
        // }
      }
      row++;
    }
  }

  private drawVertical() {
    this.drawVerticalBar();
    this.verticalLabels();
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

  update(viewportDirty: boolean) {
    // update only if dirty or if viewport is dirty and there is a column or row
    // selection (which requires a redraw)
    if (
      !this.dirty &&
      !viewportDirty &&
      !(viewportDirty && (sheets.sheet.cursor.columnRow?.columns || sheets.sheet.cursor.columnRow?.rows))
    ) {
      return;
    }
    this.dirty = false;
    this.labels.clear();

    this.headingsGraphics.clear();

    if (!pixiAppSettings.showHeadings) {
      this.visible = false;
      this.rowRect = undefined;
      this.columnRect = undefined;
      this.headingSize = { width: 0, height: 0 };
      events.emit('headingSize', this.headingSize.width, this.headingSize.height);
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
    events.emit('headingSize', this.headingSize.width, this.headingSize.height);
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
