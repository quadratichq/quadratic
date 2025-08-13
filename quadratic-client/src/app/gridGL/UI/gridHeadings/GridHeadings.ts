import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { getColumnA1Notation } from '@/app/gridGL/UI/gridHeadings/getA1Notation';
import { GridHeadingsLabels } from '@/app/gridGL/UI/gridHeadings/GridHeadingsLabels';
import { GridHeadingRows } from '@/app/gridGL/UI/gridHeadings/GridHeadingsRows';
import { calculateAlphaForGridLines } from '@/app/gridGL/UI/gridUtils';
import type { Size } from '@/app/shared/types/size';
import { colors } from '@/app/theme/colors';
import { CELL_HEIGHT, CELL_WIDTH } from '@/shared/constants/gridConstants';
import type { Point } from 'pixi.js';
import { BitmapText, Container, Graphics, Rectangle } from 'pixi.js';

type Selected = 'all' | number[] | undefined;

export type IntersectsHeadings = { column: number | null; row: number | null; corner?: true };

export interface HeadingSize {
  width: number;
  height: number;
  unscaledWidth: number;
  unscaledHeight: number;
}

// Constants for headers
export const LABEL_MAXIMUM_WIDTH_PERCENT = 0.9;
export const LABEL_MAXIMUM_HEIGHT_PERCENT = 0.5;
export const LABEL_PADDING_ROWS = 2;
export const GRID_HEADER_FONT_SIZE = 10;
export const ROW_DIGIT_OFFSET = { x: 0, y: -1 };
const GRID_HEADING_RESIZE_TOLERANCE = 3;

// this is the number of digits to use when calculating what horizontal headings are hidden
export const LABEL_DIGITS_TO_CALCULATE_SKIP = 3;

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

  headingSize: HeadingSize = { width: 0, height: 0, unscaledWidth: 0, unscaledHeight: 0 };

  // heading location for hitTest
  private rowRect: Rectangle | undefined;
  private columnRect: Rectangle | undefined;
  private cornerRect: Rectangle | undefined;

  // this needs to be a child of viewportContents so it it is placed over the
  // grid lines
  gridHeadingsRows: GridHeadingRows;

  dirty = true;

  constructor() {
    super();
    this.headingsGraphics = this.addChild(new Graphics());
    this.labels = this.addChild(new GridHeadingsLabels());
    this.corner = this.addChild(new Graphics());
    this.gridHeadingsRows = new GridHeadingRows();
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
    if (i > 100) return 52;
    if (i > 20) return 26;
    if (i > 10) return 13;
    if (i > 5) return 6;
    return 2;
  }

  private findIntervalY(i: number): number {
    if (i > 250) return 250;
    if (i > 100) return 100;
    if (i > 50) return 50;
    if (i > 25) return 25;
    if (i > 10) return 10;
    if (i > 3) return 5;
    if (i > 2) return 2;
    return 1;
  }

  // Fills horizontal bar based on selection.
  private drawHorizontalBar() {
    const viewport = pixiApp.viewport;
    const bounds = viewport.getVisibleBounds();
    const scale = viewport.scaled;
    const cellHeight = CELL_HEIGHT / scale;
    const sheet = sheets.sheet;
    const offsets = sheet.offsets;
    const cursor = sheet.cursor;
    const clamp = sheet.clamp;

    this.headingsGraphics.lineStyle(0);
    this.headingsGraphics.beginFill(colors.headerBackgroundColor);
    this.columnRect = new Rectangle(bounds.left, bounds.top, bounds.width, cellHeight);
    this.headingsGraphics.drawShape(this.columnRect);
    this.headingsGraphics.endFill();

    const left = Math.max(bounds.left, clamp.left);
    const leftColumn = sheet.getColumnFromScreen(left);
    const rightColumn = sheet.getColumnFromScreen(left + bounds.width);
    this.headingsGraphics.beginFill(pixiApp.accentColor, colors.headerSelectedRowColumnBackgroundColorAlpha);
    this.selectedColumns = cursor.getSelectedColumnRanges(leftColumn - 1, rightColumn + 1);
    for (let i = 0; i < this.selectedColumns.length; i += 2) {
      const startPlacement = offsets.getColumnPlacement(this.selectedColumns[i]);
      const start = startPlacement.position;
      let end: number;
      if (this.selectedColumns[i] === this.selectedColumns[i + 1]) {
        end = start + startPlacement.size;
      } else {
        const endPlacement = offsets.getColumnPlacement(this.selectedColumns[i + 1]);
        end = endPlacement.position + endPlacement.size;
      }
      this.headingsGraphics.drawRect(start, viewport.top, end - start, cellHeight);
    }
    this.headingsGraphics.endFill();
  }

  // Adds horizontal labels
  private horizontalLabels() {
    if (!this.characterSize) return;

    const viewport = pixiApp.viewport;
    const bounds = viewport.getVisibleBounds();
    const scale = viewport.scaled;
    const offsets = sheets.sheet.offsets;
    const cellWidth = CELL_WIDTH / scale;
    const cellHeight = CELL_HEIGHT / scale;
    const gridAlpha = calculateAlphaForGridLines(scale);

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
        this.headingsGraphics.lineStyle(
          1,
          colors.gridLines,
          colors.headerSelectedRowColumnBackgroundColorAlpha * gridAlpha,
          0.5,
          true
        );
        this.headingsGraphics.moveTo(x, bounds.top);
        this.headingsGraphics.lineTo(x, bounds.top + cellHeight);
        this.gridLinesColumns.push({ column: column - 1, x, width: offsets.getColumnWidth(column - 1) });
      }

      // show selected numbers
      const selected = Array.isArray(this.selectedColumns) ? this.selectedColumns.includes(column) : false;

      // only show the label if selected or mod calculation or first column
      if (
        selected ||
        mod === 0 ||
        (mod === 2 && column % 2 === 1) ||
        (mod !== 2 && column % mod === 0) ||
        column === start.index
      ) {
        const charactersWidth = (this.characterSize.width * column.toString().length) / scale;

        // only show labels that will fit (unless grid lines are hidden)
        if (
          scale < 0.2 || // this fixes a bug where multi letter labels were not showing when zoomed out
          currentWidth > charactersWidth ||
          pixiApp.gridLines.alpha < colors.headerSelectedRowColumnBackgroundColorAlpha
        ) {
          // don't show numbers if it overlaps with the selected value (eg, hides B if selected A overlaps it)
          let xPosition = x + currentWidth / 2;
          const left = xPosition - charactersWidth / 2;
          const right = xPosition + charactersWidth / 2;

          // we remove the last label if we're intersecting and it was not
          // selected but we are selected. We also leave first and last
          // selections, unless there is only two selections, in which case we
          // leave only the first.
          let intersectsLast =
            lastLabel && intersects.lineLineOneDimension(lastLabel.left, lastLabel.right, left, right);
          const selectedColumns = [];
          if (this.selectedColumns) {
            for (let i = 0; i < this.selectedColumns.length; i += 2) {
              for (let j = Number(this.selectedColumns[i]); j <= Number(this.selectedColumns[i + 1]); j++) {
                selectedColumns.push(j);
              }
            }
          }
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
            const text = getColumnA1Notation(column);
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

  private calculateRowWidth(bottomNumberLength: number): number {
    if (!this.characterSize) {
      throw new Error('Expected characterSize to be defined');
    }
    const { viewport } = pixiApp;
    let rowWidth =
      (bottomNumberLength * this.characterSize.width) / viewport.scale.x + (LABEL_PADDING_ROWS / viewport.scale.x) * 2;
    return Math.max(rowWidth, CELL_HEIGHT / viewport.scale.x);
  }

  private drawVerticalBar() {
    if (!this.characterSize) return;

    const viewport = pixiApp.viewport;
    const bounds = viewport.getVisibleBounds();
    const sheet = sheets.sheet;
    const cursor = sheet.cursor;
    const offsets = sheet.offsets;
    const clamp = sheet.clamp;

    const end = offsets.getYPlacement(bounds.bottom);
    const bottomOffset = end.position + end.size;
    const bottomNumberLength = Math.round(bottomOffset / CELL_HEIGHT - 1).toString().length;
    this.rowWidth = this.calculateRowWidth(bottomNumberLength);

    // draw background of vertical bar
    this.headingsGraphics.lineStyle(0);
    this.headingsGraphics.beginFill(colors.headerBackgroundColor);
    // Always start from the topmost part of the viewport (bounds.top) to ensure
    // it extends to the corner, regardless of clamp
    this.rowRect = new Rectangle(bounds.left, bounds.top, this.rowWidth, bounds.height);
    this.headingsGraphics.drawShape(this.rowRect);
    this.headingsGraphics.endFill();

    // For selection highlighting, we use clamped top
    const top = Math.max(bounds.top, clamp.top);
    const topRow = sheet.getRowFromScreen(top);
    const bottomRow = sheet.getRowFromScreen(top + bounds.height);
    this.headingsGraphics.beginFill(pixiApp.accentColor, colors.headerSelectedRowColumnBackgroundColorAlpha);

    this.selectedRows = cursor.getSelectedRowRanges(topRow, bottomRow);
    for (let i = 0; i < this.selectedRows.length; i += 2) {
      const startPlacement = offsets.getRowPlacement(this.selectedRows[i]);
      const start = startPlacement.position;
      let end: number;
      if (this.selectedRows[i] === this.selectedRows[i + 1]) {
        end = start + startPlacement.size;
      } else {
        const endPlacement = offsets.getRowPlacement(this.selectedRows[i + 1]);
        end = endPlacement.position + endPlacement.size;
      }
      this.headingsGraphics.drawRect(bounds.left, start, this.rowWidth, end - start);
    }
    this.headingsGraphics.endFill();
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
    this.gridLinesRows = [];

    // keep track of last label to ensure we don't overlap
    let lastLabel: { top: number; bottom: number; selected: boolean } | undefined = undefined;

    const halfCharacterHeight = this.characterSize.height / scale;

    const selectedRows = [];
    if (this.selectedRows) {
      for (let i = 0; i < this.selectedRows.length; i += 2) {
        for (let j = this.selectedRows[i]; j <= this.selectedRows[i + 1]; j++) {
          selectedRows.push(j);
        }
      }
    }

    for (let y = topOffset; y <= bottomOffset; y += currentHeight) {
      currentHeight = offsets.getRowHeight(row);
      if (gridAlpha !== 0) {
        this.headingsGraphics.lineStyle({
          width: 1,
          color: colors.gridLines,
          alpha: colors.headerSelectedRowColumnBackgroundColorAlpha * gridAlpha,
          alignment: 0.5,
          native: true,
        });
        this.headingsGraphics.moveTo(bounds.left, y);
        this.headingsGraphics.lineTo(bounds.left + this.rowWidth, y);
        this.gridLinesRows.push({ row: row - 1, y, height: offsets.getRowHeight(row - 1) });
      }

      // show selected numbers
      const selected = selectedRows.includes(row);

      // only show the label if selected or mod calculation or first row
      if (
        selected ||
        mod === 0 ||
        (mod === 2 && row % 2 === 1) ||
        (mod !== 2 && row % mod === 0) ||
        row === start.index
      ) {
        // only show labels that will fit (unless grid lines are hidden)
        let yPosition = y + currentHeight / 2;
        const top = yPosition - halfCharacterHeight / 2;
        const bottom = yPosition + halfCharacterHeight / 2;

        // We remove the last label if we're intersecting and it was not
        // selected but we are selected. We also leave first and last
        // selections, unless there is only two selections, in which case we
        // leave only the first.
        let intersectsLast = lastLabel && intersects.lineLineOneDimension(lastLabel.top, lastLabel.bottom, top, bottom);
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
      }
      row++;
    }
  }

  private drawVertical() {
    this.drawVerticalBar();
    this.verticalLabels();
  }

  private drawCorner() {
    const { viewport } = pixiApp;
    const bounds = viewport.getVisibleBounds();
    const cellHeight = CELL_HEIGHT / viewport.scale.x;
    this.corner.clear();
    this.corner.beginFill(colors.headerCornerBackgroundColor);
    // Always position at the top-left of viewport bounds to ensure connection with headers
    this.cornerRect = new Rectangle(bounds.left, bounds.top, this.rowWidth, cellHeight);
    this.corner.drawShape(this.cornerRect);
    this.corner.endFill();
    this.corner.lineStyle(1, colors.gridLines, colors.headerSelectedRowColumnBackgroundColorAlpha, 0, true);
    this.corner.moveTo(bounds.left + this.rowWidth, bounds.top);
    this.corner.lineTo(bounds.left + this.rowWidth, bounds.top + cellHeight);
    this.corner.lineTo(bounds.left, bounds.top + cellHeight);
  }

  // draws the lines under and to the right of the headings
  private drawHeadingLines() {
    const { viewport } = pixiApp;
    const cellHeight = CELL_HEIGHT / viewport.scale.x;
    const bounds = viewport.getVisibleBounds();
    this.headingsGraphics.lineStyle(1, colors.gridLines, colors.headerSelectedRowColumnBackgroundColorAlpha, 0.5, true);

    // draw the left line to the right of the headings
    // Start from bounds.top to ensure it connects with the corner
    this.headingsGraphics.moveTo(bounds.left + this.rowWidth, bounds.top);
    this.headingsGraphics.lineTo(bounds.left + this.rowWidth, viewport.bottom);

    // draw the top line under the headings
    // Start from bounds.left to ensure it connects with the corner
    this.headingsGraphics.moveTo(bounds.left, bounds.top + cellHeight);
    this.headingsGraphics.lineTo(bounds.right, bounds.top + cellHeight);
  }

  update = (viewportDirty: boolean) => {
    // update only if dirty or if viewport is dirty and there is a column or row
    // selection (which requires a redraw)
    if (
      !this.dirty &&
      !viewportDirty

      // todo....
      // !(viewportDirty && (sheets.sheet.cursor.columnRow?.columns || sheets.sheet.cursor.columnRow?.rows))
    ) {
      return;
    }
    this.dirty = false;
    this.labels.clear();
    this.headingsGraphics.clear();

    this.gridHeadingsRows.labels.clear();
    this.gridHeadingsRows.headingsGraphics.clear();

    if (!pixiAppSettings.showHeadings) {
      this.visible = false;
      this.rowRect = undefined;
      this.columnRect = undefined;
      this.headingSize = { width: 0, height: 0, unscaledWidth: 0, unscaledHeight: 0 };
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

    this.headingSize = {
      width: this.rowWidth * pixiApp.viewport.scale.x,
      height: CELL_HEIGHT,
      unscaledWidth: this.rowWidth,
      unscaledHeight: CELL_HEIGHT / pixiApp.viewport.scale.y,
    };
    events.emit('headingSize', this.headingSize.width, this.headingSize.height);
  };

  // whether the point is in the heading
  intersectsHeadings(world: Point): IntersectsHeadings | undefined {
    if (!this.columnRect || !this.rowRect || !this.cornerRect) return;
    const offsets = sheets.sheet.offsets;

    if (intersects.rectanglePoint(this.cornerRect, world)) {
      return { corner: true, column: null, row: null };
    }
    if (intersects.rectanglePoint(this.columnRect, world)) {
      return { column: offsets.getXPlacement(world.x).index, row: null };
    }
    if (intersects.rectanglePoint(this.rowRect, world)) {
      return { row: offsets.getYPlacement(world.y).index, column: null };
    }
  }

  // whether the point is on the heading gridLine (with tolerance)
  intersectsHeadingGridLine(
    world: Point
  ): { start: number; column: number | null; row: number | null; width?: number; height?: number } | undefined {
    if (!this.columnRect || !this.rowRect) return;

    const offsets = sheets.sheet.offsets;
    const tolerance = GRID_HEADING_RESIZE_TOLERANCE / pixiApp.viewport.scale.x;

    if (intersects.rectanglePoint(this.columnRect, world)) {
      for (const line of this.gridLinesColumns) {
        if (Math.abs(world.x - line.x) < tolerance) {
          const start = offsets.getColumnPlacement(line.column);
          return { start: start.position, column: line.column, row: null, width: line.width };
        }
      }
    }

    if (intersects.rectanglePoint(this.rowRect, world)) {
      for (const line of this.gridLinesRows) {
        if (Math.abs(world.y - line.y) < tolerance) {
          const start = offsets.getRowPlacement(line.row);
          return { start: start.position, column: null, row: line.row, height: line.height };
        }
      }
    }
  }

  /// Returns future sizes based on a new viewport position (top left)
  getFutureSizes = (viewportTopY: number): HeadingSize => {
    if (!this.characterSize) {
      throw new Error('Expected characterSize to be defined');
    }
    const { viewport } = pixiApp;
    const bounds = viewport.getVisibleBounds();
    const viewportHeight = bounds.height;

    const sheet = sheets.sheet;

    const screenBottom = viewportTopY + viewportHeight;
    const cellBottom = sheet.getRowFromScreen(screenBottom);
    const bottomNumberLength = cellBottom.toString().length;
    const rowWidth = this.calculateRowWidth(bottomNumberLength);

    return {
      width: rowWidth * pixiApp.viewport.scale.x,
      height: CELL_HEIGHT,
      unscaledWidth: rowWidth,
      unscaledHeight: CELL_HEIGHT / pixiApp.viewport.scale.y,
    };
  };
}
