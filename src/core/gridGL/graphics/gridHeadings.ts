import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { CELL_WIDTH, CELL_HEIGHT } from '../../../constants/gridConstants';
import { colors } from '../../../theme/colors';
import { calculateAlphaForGridLines } from './gridUtils';
import { Size } from '../types/size';
import { pixiKeyboardCanvasProps } from '../interaction/useKeyboardCanvas';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { intersects } from '../helpers/intersects';
import { isArrayShallowEqual } from '../helpers/isEqual';
import { gridOffsets } from '../../gridDB/gridOffsets';

// this ensures the top-left corner of the viewport doesn't move when toggling headings
export const OFFSET_HEADINGS = false;

// Constants for headers
export const LABEL_MAXIMUM_WIDTH_PERCENT = 0.7;
export const LABEL_MAXIMUM_HEIGHT_PERCENT = 0.5;
export const LABEL_PADDING_ROWS = 2;
export const GRID_HEADER_FONT_SIZE = 9;
export const ROW_DIGIT_OFFSET = { x: 0, y: -1 };
const GRID_HEADING_RESIZE_TOLERANCE = 2;

// this is the number of digits to use when calculating what horizontal headings are hidden
export const LABEL_DIGITS_TO_CALCULATE_SKIP = 4;

interface IProps {
  viewport: Viewport;
  headings: PIXI.Container;
  graphics: PIXI.Graphics;
  labels: PIXI.Container;
  corner: PIXI.Graphics;
  dirty: boolean;
}

interface LabelData {
  text: string;
  x: number;
  y: number;
}

let characterSize: Size | undefined = undefined;

// calculates static character size (used in overlap calculations)
function calculateCharacterSize(): void {
  const label = new PIXI.BitmapText('X', {
    fontName: 'OpenSans',
    fontSize: GRID_HEADER_FONT_SIZE,
    tint: 0x55606b,
  });
  characterSize = { width: label.width, height: label.height };
}

// simple interval finding algorithm -- this can be improved to allow for different intervals
function findInterval(i: number): number {
  if (i > 100) return 500;
  if (i > 50) return 100;
  if (i > 10) return 50;
  if (i > 5) return 10;
  return 5;
}

// creates arrays of selected columns and rows
function createSelectedArrays(interactionState: GridInteractionState): {
  selectedColumns: number[];
  selectedRows: number[];
} {
  const selectedColumns: number[] = [],
    selectedRows: number[] = [];
  if (interactionState.showMultiCursor) {
    for (
      let x = interactionState.multiCursorPosition.originPosition.x;
      x <= interactionState.multiCursorPosition.terminalPosition.x;
      x++
    ) {
      selectedColumns.push(x);
    }
    for (
      let y = interactionState.multiCursorPosition.originPosition.y;
      y <= interactionState.multiCursorPosition.terminalPosition.y;
      y++
    ) {
      selectedRows.push(y);
    }
  } else {
    selectedColumns.push(interactionState.cursorPosition.x);
    selectedRows.push(interactionState.cursorPosition.y);
  }
  return { selectedColumns, selectedRows };
}

// global variables (these are needed since recoil state setting falls behind the frame rate)
export const gridHeadingsGlobals: { showHeadings: boolean; interactionState: GridInteractionState } = {
  showHeadings: true,
  interactionState: {} as GridInteractionState,
};

// cached globals to avoid redrawing if possible
let lastRowSize: Size = { width: 0, height: 0 };
let lastShowHeadings = false;

// cached heading location for hitTest
let lastRowRect: PIXI.Rectangle | undefined;
let lastColumnRect: PIXI.Rectangle | undefined;
let lastCornerRect: PIXI.Rectangle | undefined;
let lastSelectedColumns: number[] | undefined;
let lastSelectedRows: number[] | undefined;
let lastGridLinesColumns: { columnRight: number, x: number }[];
let lastGridLinesRows: { rowBottom: number, y: number }[];

export function gridHeadings(props: IProps) {
  const { viewport, headings, graphics, corner, labels, dirty } = props;

  const { selectedColumns, selectedRows } = createSelectedArrays(gridHeadingsGlobals.interactionState);

  // only redraw headings if dirty or selection has changed
  if (
    !dirty &&
    isArrayShallowEqual(selectedColumns, lastSelectedColumns) &&
    isArrayShallowEqual(selectedRows, lastSelectedRows)
  )
    return;
  lastSelectedColumns = selectedColumns;
  lastSelectedRows = selectedRows;

  graphics.clear();
  corner.clear();

  // handle showHeadings = false and allow for adjust headings (if OFFSET_HEADINGS flag is set)
  if (!gridHeadingsGlobals.showHeadings) {
    headings.visible = false;
    if (lastShowHeadings) {
      if (OFFSET_HEADINGS) {
        viewport.x -= lastRowSize.width;
        viewport.y -= lastRowSize.height;
        lastShowHeadings = false;
      }
      lastRowRect = undefined;
      lastColumnRect = undefined;
      lastColumnRect = undefined;
    }
    return;
  }
  headings.visible = true;
  if (!characterSize) {
    calculateCharacterSize();
  }

  const cellWidth = CELL_WIDTH / viewport.scale.x;
  const cellHeight = CELL_HEIGHT / viewport.scale.x;
  const inverseScale = 1 / viewport.scale.x;
  const gridAlpha = calculateAlphaForGridLines(viewport);
  let bounds = viewport.getVisibleBounds();

  // holds data for horizontal and vertical labels
  let labelData: LabelData[] = [];

  const drawHorizontal = () => {
    if (!characterSize) return;

    // draw horizontal bar
    graphics.lineStyle(0);
    graphics.beginFill(colors.headerBackgroundColor);
    lastColumnRect = new PIXI.Rectangle(viewport.left, viewport.top, viewport.right - viewport.left, cellHeight);
    graphics.drawShape(lastColumnRect);
    graphics.endFill();

    // calculate selection bounds
    const selectedStart = gridOffsets.getColumnPlacement(selectedColumns[0]);
    const selectedEnd = gridOffsets.getColumnPlacement(selectedColumns[selectedColumns.length - 1]);
    const xSelectedStart = selectedStart.x;
    let xSelectedEnd = xSelectedStart + selectedStart.width;
    for (let i = 1; i < selectedColumns.length; i++) {
      xSelectedEnd += gridOffsets.getColumnWidth(selectedColumns[i]);
    }

    // use these bounds for digit overlap comparison
    const startHalfWidth = characterSize.width * selectedColumns[0].toString().length / 2 / viewport.scale.x;
    const endHalfWidth = characterSize.width * selectedColumns[0].toString().length / 2 / viewport.scale.x;
    const xSelectedStartLine1D = { start: xSelectedStart + selectedStart.width / 2 - startHalfWidth, end: xSelectedStart + selectedStart.width / 2 + startHalfWidth };
    const xSelectedEndLine1D = { start: xSelectedEnd - selectedEnd.width / 2 - endHalfWidth, end: xSelectedEnd - selectedEnd.width / 2 + endHalfWidth };

    // highlight column headings based on selected cells
    graphics.beginFill(colors.headerSelectedBackgroundColor);
    graphics.drawRect(xSelectedStart, viewport.top, xSelectedEnd - xSelectedStart, cellHeight);
    graphics.endFill();

    const start = gridOffsets.getColumnIndex(bounds.left);
    const end = gridOffsets.getColumnIndex(bounds.right);
    const leftOffset = start.position;
    const rightOffset = end.position;

    // labelWidth uses the constant for number of digits--this ensures the mod factor doesn't change when panning
    const labelWidth = LABEL_DIGITS_TO_CALCULATE_SKIP * characterSize.width;
    let mod = 0;
    if (labelWidth > CELL_WIDTH * viewport.scale.x * LABEL_MAXIMUM_WIDTH_PERCENT) {
      const skipNumbers = Math.ceil((cellWidth * (1 - LABEL_MAXIMUM_WIDTH_PERCENT)) / labelWidth);
      mod = findInterval(skipNumbers);
    }

    const y = bounds.top + cellHeight / 2;
    let column = start.index;
    let currentWidth = 0;
    lastGridLinesColumns = [];
    for (let x = leftOffset; x <= rightOffset; x += currentWidth) {
      currentWidth = gridOffsets.getColumnWidth(column);
      if (gridAlpha !== 0) {
        graphics.lineStyle(1, colors.cursorCell, 0.25 * gridAlpha, 0.5, true);
        graphics.moveTo(x, bounds.top);
        graphics.lineTo(x, bounds.top + cellHeight);
        lastGridLinesColumns.push({ columnRight: column, x });
      }

      // show first and last selected numbers unless last selected number overlaps first selected number
      const selected =
        selectedColumns[0] === column ||
        (selectedColumns.length > 1 && selectedColumns[selectedColumns.length - 1] === column && !intersects.lineLineOneDimension(xSelectedStartLine1D.start, xSelectedStartLine1D.end, xSelectedEndLine1D.start, xSelectedEndLine1D.end));

      // only show the label if selected or mod calculation
      if (selected || mod === 0 || column % mod === 0) {
        // don't show numbers if it overlaps with the selected value (eg, hides 0 if selected 1 overlaps it)
        let xPosition = x + currentWidth / 2;
        const characterHalfWidth = characterSize.width * column.toString().length / 2 / viewport.scale.x;
        const left = xPosition - characterHalfWidth;
        const right = xPosition + characterHalfWidth;

        // only when selected or not intersects one of the selected numbers
        if (selected || !(intersects.lineLineOneDimension(xSelectedStartLine1D.start, xSelectedStartLine1D.end, left, right) ||
          intersects.lineLineOneDimension(xSelectedEndLine1D.start, xSelectedEndLine1D.end, left, right))) {
          labelData.push({ text: column.toString(), x: xPosition, y });
        }
      }
      column++;
    }
  };

  let rowWidth: number;
  const drawVertical = () => {
    if (!characterSize) return;

    // determine width of row header
    const start = gridOffsets.getRowIndex(bounds.top);
    const end = gridOffsets.getRowIndex(bounds.bottom);
    const topOffset = start.position;
    const bottomOffset = end.position;
    const topNumberLength = Math.round(topOffset / CELL_HEIGHT - 1).toString().length;
    const bottomNumberLength = Math.round(bottomOffset / CELL_HEIGHT - 1).toString().length;

    // rowWidth is the maximum number of digits of the top number and bottom number * characterSize.width
    rowWidth =
      (Math.max(topNumberLength, bottomNumberLength) * characterSize.width) / viewport.scale.x +
      (LABEL_PADDING_ROWS / viewport.scale.x) * 2;
    rowWidth = Math.max(rowWidth, CELL_HEIGHT / viewport.scale.x);

    // draw vertical bar
    graphics.lineStyle(0);
    graphics.beginFill(colors.headerBackgroundColor);
    const top = bounds.top + cellHeight;
    const bottom = bounds.height - cellHeight;
    lastRowRect = new PIXI.Rectangle(bounds.left, top, rowWidth, bottom);
    graphics.drawShape(lastRowRect);
    graphics.endFill();

    // calculated selection bounds
    const selectedStart = gridOffsets.getRowPlacement(selectedRows[0]);
    const selectedEnd = gridOffsets.getRowPlacement(selectedRows[selectedRows.length - 1]);
    const ySelectedStart = selectedStart.y;
    let ySelectedEnd = ySelectedStart + selectedStart.height;
    for (let i = 1; i < selectedRows.length; i++) {
      ySelectedEnd += gridOffsets.getRowHeight(selectedRows[i]);
    }
    const halfCharacterHeight = characterSize.height / 2 / viewport.scale.x;

    // use these bounds for digit overlap comparison
    const ySelectedStartLine1D = { start: ySelectedStart + selectedStart.height / 2 - halfCharacterHeight, end: ySelectedStart + selectedStart.height / 2 + halfCharacterHeight };
    const ySelectedEndLine1D = { start: ySelectedEnd - selectedEnd.height / 2 - halfCharacterHeight, end: ySelectedEnd - selectedEnd.height / 2 + halfCharacterHeight };

    // highlight row headings based on selected cells
    graphics.beginFill(colors.headerSelectedBackgroundColor);
    graphics.drawRect(viewport.left, ySelectedStart, rowWidth, ySelectedEnd - ySelectedStart);
    graphics.endFill();

    let mod = 0;
    if (characterSize.height > CELL_HEIGHT * viewport.scale.y * LABEL_MAXIMUM_HEIGHT_PERCENT) {
      const skipNumbers = Math.ceil((cellHeight * (1 - LABEL_MAXIMUM_HEIGHT_PERCENT)) / characterSize.height);
      mod = findInterval(skipNumbers);
    }

    const x = bounds.left + rowWidth / 2;
    let row = start.index;
    let currentHeight = 0;
    lastGridLinesRows = [];
    for (let y = topOffset; y <= bottomOffset; y += currentHeight) {
      currentHeight = gridOffsets.getRowHeight(row);
      if (gridAlpha !== 0) {
        graphics.lineStyle(1, colors.cursorCell, 0.25 * gridAlpha, 0.5, true);
        graphics.moveTo(bounds.left, y);
        graphics.lineTo(bounds.left + rowWidth, y);
        lastGridLinesRows.push({ rowBottom: row, y });
      }

      // show first and last selected numbers unless last selected number overlaps first selected number
      const selected =
        selectedRows[0] === row || (selectedRows.length > 1 && selectedRows[selectedRows.length - 1] === row && !intersects.lineLineOneDimension(ySelectedStartLine1D.start, ySelectedStartLine1D.end, ySelectedEndLine1D.start, ySelectedEndLine1D.end));

      // only show the label if selected or mod calculation
      if (selected || mod === 0 || row % mod === 0) {
        // don't show numbers if it overlaps with the selected value (eg, allows digit 1 to show if it overlaps digit 0)
        let yPosition = y + currentHeight / 2;
        const top = yPosition - halfCharacterHeight;
        const bottom = yPosition + halfCharacterHeight;
        if (selected || !(intersects.lineLineOneDimension(ySelectedStartLine1D.start, ySelectedStartLine1D.end, top, bottom) ||
          intersects.lineLineOneDimension(ySelectedEndLine1D.start, ySelectedEndLine1D.end, top, bottom))) {
          labelData.push({
            text: row.toString(),
            x: x + ROW_DIGIT_OFFSET.x,
            y: yPosition + ROW_DIGIT_OFFSET.y,
          });
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
  };

  const drawCorner = () => {
    corner.beginFill(colors.headerCornerBackgroundColor);
    lastCornerRect = new PIXI.Rectangle(bounds.left, bounds.top, rowWidth, cellHeight);
    corner.drawShape(lastCornerRect);
    corner.endFill();
  };

  const drawHeadingLines = () => {
    graphics.lineStyle(1, colors.cursorCell, 0.25, 0.5, true);
    graphics.moveTo(bounds.left + rowWidth, viewport.top);
    graphics.lineTo(bounds.left + rowWidth, viewport.bottom);
    graphics.moveTo(bounds.left, bounds.top + cellHeight);
    graphics.lineTo(bounds.right, bounds.top + cellHeight);
  };

  const addLabel = (): PIXI.BitmapText => {
    const label = labels.addChild(
      new PIXI.BitmapText('', {
        fontName: 'OpenSans',
        fontSize: GRID_HEADER_FONT_SIZE,
        tint: 0x55606b,
      })
    );
    label.anchor.set(0.5);
    return label;
  };

  // add labels to headings using cached labels
  const addLabels = () => {
    const available = [...labels.children] as PIXI.BitmapText[];
    const leftovers: LabelData[] = [];

    // reuse existing labels that have the same text
    labelData.forEach((data) => {
      const index = available.findIndex((label) => label.text === data.text);
      if (index === -1) {
        leftovers.push(data);
      } else {
        const label = available[index];
        label.visible = true;
        label.scale.set(inverseScale);
        label.position.set(data.x, data.y);
        available.splice(index, 1);
      }
    });

    // use existing labels but change the text
    leftovers.forEach((data, i) => {
      let label: PIXI.BitmapText;
      if (i < available.length) {
        label = available[i];
        label.visible = true;
      }

      // otherwise create new labels
      else {
        label = addLabel();
      }
      label.scale.set(inverseScale);
      label.position.set(data.x, data.y);
      label.text = data.text;
    });
  };

  labels.children.forEach((child) => (child.visible = false));
  drawVertical();

  // adjust viewport position if headings are new
  if (!lastShowHeadings) {
    if (OFFSET_HEADINGS) {
      viewport.x += rowWidth!;
      viewport.y += CELL_HEIGHT;
    }
    lastShowHeadings = true;

    // need to start over to take into account change in viewport position
    bounds = viewport.getVisibleBounds();
    labelData = [];
    drawVertical();
  }

  drawHorizontal();
  drawHeadingLines();
  addLabels();
  drawCorner();
  pixiKeyboardCanvasProps.headerSize = {
    width: rowWidth!,
    height: CELL_HEIGHT,
  };
  lastRowSize = { width: rowWidth!, height: CELL_HEIGHT };
}

export function intersectsHeadings(world: PIXI.Point): { column?: number; row?: number; corner?: true } | undefined {
  if (!lastColumnRect || !lastRowRect || !lastCornerRect) return;
  if (intersects.rectanglePoint(lastCornerRect, world)) {
    return { corner: true };
  }
  if (intersects.rectanglePoint(lastColumnRect, world)) {
    return { column: gridOffsets.getColumnIndex(world.x).index };
  }
  if (intersects.rectanglePoint(lastRowRect, world)) {
    return { row: gridOffsets.getRowIndex(world.y).index };
  }
}

export function intersectsHeadingGridLine(world: PIXI.Point): { column?: number; row?: number } | undefined {
  if (!lastColumnRect || !lastRowRect) return;
  if (intersects.rectanglePoint(lastColumnRect, world)) {
    for (const line of lastGridLinesColumns) {
      if (Math.abs(world.x - line.x) < GRID_HEADING_RESIZE_TOLERANCE) {
        return { column: line.columnRight };
      }
    }
  }
  if (intersects.rectanglePoint(lastRowRect, world)) {
    for (const line of lastGridLinesRows) {
      if (Math.abs(world.y - line.y) < GRID_HEADING_RESIZE_TOLERANCE) {
        return { row: line.rowBottom };
      }
    }
  }
}