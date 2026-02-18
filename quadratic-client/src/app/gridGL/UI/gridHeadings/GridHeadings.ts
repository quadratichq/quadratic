import { events, type DirtyObject } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { getColumnA1Notation } from '@/app/gridGL/UI/gridHeadings/getA1Notation';
import { GridHeadingsLabels } from '@/app/gridGL/UI/gridHeadings/GridHeadingsLabels';
import { GridHeadingRows } from '@/app/gridGL/UI/gridHeadings/GridHeadingsRows';
import { calculateAlphaForGridLines } from '@/app/gridGL/UI/gridUtils';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import type { Size } from '@/app/shared/types/size';
import { colors } from '@/app/theme/colors';
import { CELL_HEIGHT, CELL_WIDTH } from '@/shared/constants/gridConstants';
import type { Point } from 'pixi.js';
import { Container, Graphics, Rectangle } from 'pixi.js';

type Selected = 'all' | number[] | undefined;

export type IntersectsHeadings = { column: number | null; row: number | null; corner?: true };

interface HeadingSize {
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
  private characterSize: Size = { width: 6.666666895151138, height: 8.09523868560791 };
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

  gridHeadingsRows: GridHeadingRows;

  dirty = true;

  constructor() {
    super();
    this.headingsGraphics = this.addChild(new Graphics());
    this.labels = this.addChild(new GridHeadingsLabels());
    this.corner = this.addChild(new Graphics());
    this.gridHeadingsRows = new GridHeadingRows();

    events.on('setDirty', this.setDirty);

    // Listen for focus/blur events to update heading colors when grid focus changes
    document.addEventListener('focusin', this.handleFocusChange);
    document.addEventListener('focusout', this.handleFocusChange);
  }

  destroy() {
    events.off('setDirty', this.setDirty);
    document.removeEventListener('focusin', this.handleFocusChange);
    document.removeEventListener('focusout', this.handleFocusChange);
    super.destroy();
  }

  private handleFocusChange = () => {
    // Mark as dirty when focus changes (the update will check if canvas is focused)
    this.dirty = true;
  };

  private setDirty = (dirty: DirtyObject) => {
    if (dirty.headings) {
      this.dirty = true;
    }
  };

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
    // Use light gray for selected headings when grid doesn't have focus, otherwise use accent color
    const selectionColor = pixiAppSettings.isGridFocused()
      ? content.accentColor
      : getCSSVariableTint('muted-foreground');
    this.headingsGraphics.beginFill(selectionColor, colors.headerSelectedRowColumnBackgroundColorAlpha);
    const baseColumnRanges = cursor.getSelectedColumnRanges(leftColumn - 1, rightColumn + 1);
    this.selectedColumns = this.expandColumnRangesForMergedCells(baseColumnRanges, leftColumn - 1, rightColumn + 1);
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
        if (column > 0) {
          this.headingsGraphics.lineStyle(
            1,
            colors.gridLines,
            colors.headerSelectedRowColumnBackgroundColorAlpha * gridAlpha,
            0.5,
            true
          );
          this.headingsGraphics.moveTo(x, bounds.top);
          this.headingsGraphics.lineTo(x, bounds.top + cellHeight);
        }
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
          content.gridLines.alpha < colors.headerSelectedRowColumnBackgroundColorAlpha
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
          if (!intersectsLast && column > 0) {
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
    const scale = pixiApp.viewport.scale.x;
    let rowWidth = (bottomNumberLength * this.characterSize.width) / scale + (LABEL_PADDING_ROWS / scale) * 2;
    return Math.max(rowWidth, CELL_HEIGHT / scale);
  }

  /**
   * Expands column ranges to include all columns within merged cells in the selection.
   * Returns ranges in the format [start1, end1, start2, end2, ...]
   */
  private expandColumnRangesForMergedCells(baseRanges: number[], fromColumn: number, toColumn: number): number[] {
    const sheet = sheets.sheet;
    const cursor = sheet.cursor;

    // Get finite ref range bounds which already includes merged cells
    const finiteRanges = cursor.getFiniteRefRangeBounds();

    // Collect all columns from the finite ranges
    const allColumns = new Set<number>();
    // Track merged cells we've already processed to avoid duplicate work
    const processedMergedCells = new Set<string>();

    // Add columns from base ranges
    for (let i = 0; i < baseRanges.length; i += 2) {
      for (let col = baseRanges[i]; col <= baseRanges[i + 1]; col++) {
        allColumns.add(col);
      }
    }

    // Add columns from finite ranges and check for merged cells
    for (const range of finiteRanges) {
      const startCol = Number(range.start.col.coord);
      const endCol = Number(range.end.col.coord);
      const startRow = Number(range.start.row.coord);
      const endRow = Number(range.end.row.coord);

      // Skip unbounded ranges
      if (startCol === -1 || endCol === -1 || startRow === -1 || endRow === -1) continue;

      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);

      // Add columns from the base selection range
      for (let col = minCol; col <= maxCol; col++) {
        if (col >= fromColumn && col <= toColumn) {
          allColumns.add(col);
        }
      }

      // Get all merged cells in this range
      const rangeRect = new Rectangle(minCol, minRow, maxCol - minCol + 1, maxRow - minRow + 1);
      const mergedCells = sheet.getMergeCellsInRect(rangeRect);

      // Process each merged cell
      for (const mergeRect of mergedCells) {
        // Create a unique key for this merged cell
        const mergeKey = `${mergeRect.min.x},${mergeRect.min.y},${mergeRect.max.x},${mergeRect.max.y}`;

        // Only process if we haven't seen this merged cell before
        if (!processedMergedCells.has(mergeKey)) {
          processedMergedCells.add(mergeKey);

          // Add all columns from this merged cell
          const mergeMinCol = Number(mergeRect.min.x);
          const mergeMaxCol = Number(mergeRect.max.x);

          for (let mergeCol = mergeMinCol; mergeCol <= mergeMaxCol; mergeCol++) {
            if (mergeCol >= fromColumn && mergeCol <= toColumn) {
              allColumns.add(mergeCol);
            }
          }
        }
      }

      // Also check corner cells for merged cells that might partially overlap
      const cornerCells = [
        { col: minCol, row: minRow },
        { col: maxCol, row: minRow },
        { col: minCol, row: maxRow },
        { col: maxCol, row: maxRow },
      ];

      for (const cell of cornerCells) {
        const mergeRect = sheet.getMergeCellRect(cell.col, cell.row);
        if (mergeRect) {
          const mergeKey = `${mergeRect.min.x},${mergeRect.min.y},${mergeRect.max.x},${mergeRect.max.y}`;

          if (!processedMergedCells.has(mergeKey)) {
            processedMergedCells.add(mergeKey);

            const mergeMinCol = Number(mergeRect.min.x);
            const mergeMaxCol = Number(mergeRect.max.x);

            for (let mergeCol = mergeMinCol; mergeCol <= mergeMaxCol; mergeCol++) {
              if (mergeCol >= fromColumn && mergeCol <= toColumn) {
                allColumns.add(mergeCol);
              }
            }
          }
        }
      }
    }

    // Convert set to sorted array
    const sortedColumns = Array.from(allColumns).sort((a, b) => a - b);

    // Convert to ranges format
    if (sortedColumns.length === 0) return [];

    const ranges: number[] = [];
    let rangeStart = sortedColumns[0];
    let rangeEnd = sortedColumns[0];

    for (let i = 1; i < sortedColumns.length; i++) {
      if (sortedColumns[i] === rangeEnd + 1) {
        rangeEnd = sortedColumns[i];
      } else {
        ranges.push(rangeStart, rangeEnd);
        rangeStart = sortedColumns[i];
        rangeEnd = sortedColumns[i];
      }
    }
    ranges.push(rangeStart, rangeEnd);

    return ranges;
  }

  /**
   * Expands row ranges to include all rows within merged cells in the selection.
   * Returns ranges in the format [start1, end1, start2, end2, ...]
   */
  private expandRowRangesForMergedCells(baseRanges: number[], fromRow: number, toRow: number): number[] {
    const sheet = sheets.sheet;
    const cursor = sheet.cursor;

    // Get finite ref range bounds which already includes merged cells
    const finiteRanges = cursor.getFiniteRefRangeBounds();

    // Collect all rows from the finite ranges
    const allRows = new Set<number>();
    // Track merged cells we've already processed to avoid duplicate work
    const processedMergedCells = new Set<string>();

    // Add rows from base ranges
    for (let i = 0; i < baseRanges.length; i += 2) {
      for (let row = baseRanges[i]; row <= baseRanges[i + 1]; row++) {
        allRows.add(row);
      }
    }

    // Add rows from finite ranges and check for merged cells
    for (const range of finiteRanges) {
      const startCol = Number(range.start.col.coord);
      const endCol = Number(range.end.col.coord);
      const startRow = Number(range.start.row.coord);
      const endRow = Number(range.end.row.coord);

      // Skip unbounded ranges
      if (startCol === -1 || endCol === -1 || startRow === -1 || endRow === -1) continue;

      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);

      // Add rows from the base selection range
      for (let row = minRow; row <= maxRow; row++) {
        if (row >= fromRow && row <= toRow) {
          allRows.add(row);
        }
      }

      // Get all merged cells in this range
      const rangeRect = new Rectangle(minCol, minRow, maxCol - minCol + 1, maxRow - minRow + 1);
      const mergedCells = sheet.getMergeCellsInRect(rangeRect);

      // Process each merged cell
      for (const mergeRect of mergedCells) {
        // Create a unique key for this merged cell
        const mergeKey = `${mergeRect.min.x},${mergeRect.min.y},${mergeRect.max.x},${mergeRect.max.y}`;

        // Only process if we haven't seen this merged cell before
        if (!processedMergedCells.has(mergeKey)) {
          processedMergedCells.add(mergeKey);

          // Add all rows from this merged cell
          const mergeMinRow = Number(mergeRect.min.y);
          const mergeMaxRow = Number(mergeRect.max.y);

          for (let mergeRow = mergeMinRow; mergeRow <= mergeMaxRow; mergeRow++) {
            if (mergeRow >= fromRow && mergeRow <= toRow) {
              allRows.add(mergeRow);
            }
          }
        }
      }

      // Also check corner cells for merged cells that might partially overlap
      const cornerCells = [
        { col: minCol, row: minRow },
        { col: maxCol, row: minRow },
        { col: minCol, row: maxRow },
        { col: maxCol, row: maxRow },
      ];

      for (const cell of cornerCells) {
        const mergeRect = sheet.getMergeCellRect(cell.col, cell.row);
        if (mergeRect) {
          const mergeKey = `${mergeRect.min.x},${mergeRect.min.y},${mergeRect.max.x},${mergeRect.max.y}`;

          if (!processedMergedCells.has(mergeKey)) {
            processedMergedCells.add(mergeKey);

            const mergeMinRow = Number(mergeRect.min.y);
            const mergeMaxRow = Number(mergeRect.max.y);

            for (let mergeRow = mergeMinRow; mergeRow <= mergeMaxRow; mergeRow++) {
              if (mergeRow >= fromRow && mergeRow <= toRow) {
                allRows.add(mergeRow);
              }
            }
          }
        }
      }
    }

    // Convert set to sorted array
    const sortedRows = Array.from(allRows).sort((a, b) => a - b);

    // Convert to ranges format
    if (sortedRows.length === 0) return [];

    const ranges: number[] = [];
    let rangeStart = sortedRows[0];
    let rangeEnd = sortedRows[0];

    for (let i = 1; i < sortedRows.length; i++) {
      if (sortedRows[i] === rangeEnd + 1) {
        rangeEnd = sortedRows[i];
      } else {
        ranges.push(rangeStart, rangeEnd);
        rangeStart = sortedRows[i];
        rangeEnd = sortedRows[i];
      }
    }
    ranges.push(rangeStart, rangeEnd);

    return ranges;
  }

  private drawVerticalBar() {
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
    // Use light gray for selected headings when grid doesn't have focus, otherwise use accent color
    const selectionColor = pixiAppSettings.isGridFocused()
      ? content.accentColor
      : getCSSVariableTint('muted-foreground');
    this.headingsGraphics.beginFill(selectionColor, colors.headerSelectedRowColumnBackgroundColorAlpha);

    const baseRowRanges = cursor.getSelectedRowRanges(topRow, bottomRow);
    this.selectedRows = this.expandRowRangesForMergedCells(baseRowRanges, topRow, bottomRow);
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
        if (row > 0) {
          this.headingsGraphics.lineStyle({
            width: 1,
            color: colors.gridLines,
            alpha: colors.headerSelectedRowColumnBackgroundColorAlpha * gridAlpha,
            alignment: 0.5,
            native: true,
          });
          this.headingsGraphics.moveTo(bounds.left, y);
          this.headingsGraphics.lineTo(bounds.left + this.rowWidth, y);
        }
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
        if (
          currentHeight === 0 ||
          (currentHeight < halfCharacterHeight &&
            scale >= 0.2 &&
            content.gridLines.alpha >= colors.headerSelectedRowColumnBackgroundColorAlpha)
        ) {
          row++;
          continue;
        }

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
        if (!intersectsLast && row > 0) {
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
    if (!this.dirty && !viewportDirty) return;

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
    // When headings are off, return all zeros
    if (!pixiAppSettings.showHeadings) {
      return { width: 0, height: 0, unscaledWidth: 0, unscaledHeight: 0 };
    }

    const { viewport } = pixiApp;
    const bounds = viewport.getVisibleBounds();
    const viewportHeight = bounds.height;
    const screenBottom = viewportTopY + viewportHeight;
    const cellBottom = sheets.sheet.getRowFromScreen(screenBottom);
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
