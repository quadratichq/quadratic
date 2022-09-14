import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { CELL_WIDTH, CELL_HEIGHT } from '../../../constants/gridConstants';
import { colors } from '../../../theme/colors';
import { calculateAlphaForGridLines } from './gridUtils';
import { Size } from '../types/size';
import { pixiKeyboardCanvasProps } from '../interaction/useKeyboardCanvas';

// this ensures the top-left corner of the viewport doesn't move when toggling headings
export const OFFSET_HEADINGS = false;

// Constants for headers
export const LABEL_MAXIMUM_WIDTH_PERCENT = 0.7;
export const LABEL_MAXIMUM_HEIGHT_PERCENT = 0.5;
export const LABEL_PADDING_ROWS = 2;
export const GRID_HEADER_FONT_SIZE = 9;
export const ROW_DIGIT_OFFSET = { x: 0, y: -1 };

// this is the number of digits to use when calculating what horizontal headings are hidden
export const LABEL_DIGITS_TO_CALCULATE_SKIP = 4;

interface IProps {
  viewport: Viewport;
  headings: PIXI.Container;
  graphics: PIXI.Graphics;
  labels: PIXI.Container;
  corner: PIXI.Graphics;
}

interface LabelData {
  text: string;
  x: number;
  y: number;
}

let characterSize: Size | undefined = undefined;

function calculateCharacterSize(): void {
  const label = new PIXI.BitmapText('X', {
    fontName: 'OpenSans',
    fontSize: GRID_HEADER_FONT_SIZE,
    tint: 0x55606b,
  });
  characterSize = { width: label.width, height: label.height };
}

function findInterval(i: number): number {
  if (i > 100) return 500;
  if (i > 50) return 100;
  if (i > 10) return 50;
  if (i > 5) return 10;
  return 5;
}

export const gridHeadingsGlobals = { showHeadings: true };
let lastRowSize: Size = { width: 0, height: 0 };
let lastShowHeadings = false;

export function gridHeadings(props: IProps) {
  const { viewport, headings, graphics, corner, labels } = props;

  graphics.clear();
  corner.clear();

  if (!gridHeadingsGlobals.showHeadings) {
    headings.visible = false;
    if (lastShowHeadings) {
      if (OFFSET_HEADINGS) {
        viewport.x -= lastRowSize.width;
        viewport.y -= lastRowSize.height;
        lastShowHeadings = false;
      }
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

    // draw bar
    graphics.beginFill(colors.headerBackgroundColor);
    graphics.drawRect(
      viewport.left,
      viewport.top,
      viewport.right - viewport.left,
      cellHeight
    );

    // calculate whether we need to skip numbers
    const xOffset = bounds.left % CELL_WIDTH;
    const leftOffset = bounds.left - xOffset - CELL_WIDTH / 2;
    const rightOffset = bounds.right - xOffset + 1.5 * CELL_WIDTH;

    // labelWidth uses the constant for number of digits--this ensures the mod factor doesn't change when panning
    const labelWidth = LABEL_DIGITS_TO_CALCULATE_SKIP * characterSize.width;
    let mod = 0;
    if (
      labelWidth >
      CELL_WIDTH * viewport.scale.x * LABEL_MAXIMUM_WIDTH_PERCENT
    ) {
      const skipNumbers = Math.ceil(
        (cellWidth * (1 - LABEL_MAXIMUM_WIDTH_PERCENT)) / labelWidth
      );
      mod = findInterval(skipNumbers);
    }

    // create labelData
    const y = bounds.top + cellHeight / 2;
    for (let x = leftOffset; x < rightOffset; x += CELL_WIDTH) {
      const column = Math.round(x / CELL_WIDTH - 1);
      if (mod === 0 || column % mod === 0) {
        labelData.push({ text: column.toString(), x, y });
      }
      if (gridAlpha !== 0) {
        graphics.lineStyle(1, colors.cursorCell, 0.25 * gridAlpha, 0.5, true);
        graphics.moveTo(x - CELL_WIDTH / 2, bounds.top);
        graphics.lineTo(x - CELL_WIDTH / 2, bounds.top + cellHeight);
      }
    }
  };

  let rowWidth: number;
  const drawVertical = () => {
    if (!characterSize) return;

    // determine width of row header
    const yOffset = bounds.top % CELL_HEIGHT;
    const topOffset = bounds.top - yOffset - CELL_HEIGHT / 2;
    const bottomOffset = bounds.bottom - yOffset + 1.5 * CELL_HEIGHT;
    const topNumberLength = Math.round(topOffset / CELL_HEIGHT - 1).toString()
      .length;
    const bottomNumberLength = Math.round(
      bottomOffset / CELL_HEIGHT - 1
    ).toString().length;

    // rowWidth is the maximum number of digits of the top number and bottom number * characterSize.width
    rowWidth =
      (Math.max(topNumberLength, bottomNumberLength) * characterSize.width) /
        viewport.scale.x +
      (LABEL_PADDING_ROWS / viewport.scale.x) * 2;
    rowWidth = Math.max(rowWidth, CELL_HEIGHT / viewport.scale.x);

    graphics.lineStyle(0);
    graphics.beginFill(colors.headerBackgroundColor);
    graphics.drawRect(
      bounds.left,
      bounds.top + CELL_HEIGHT / viewport.scale.x,
      rowWidth,
      bounds.height - CELL_HEIGHT / viewport.scale.x
    );
    let mod = 0;
    if (
      characterSize.height >
      CELL_HEIGHT * viewport.scale.y * LABEL_MAXIMUM_HEIGHT_PERCENT
    ) {
      const skipNumbers = Math.ceil(
        (cellHeight * (1 - LABEL_MAXIMUM_HEIGHT_PERCENT)) / characterSize.height
      );
      mod = findInterval(skipNumbers);
    }
    const x = bounds.left + rowWidth / 2;
    for (let y = topOffset; y < bottomOffset; y += CELL_HEIGHT) {
      const row = Math.round(y / CELL_HEIGHT - 1);
      if (mod === 0 || row % mod === 0) {
        labelData.push({
          text: row.toString(),
          x: x + ROW_DIGIT_OFFSET.x,
          y: y + ROW_DIGIT_OFFSET.y,
        });
      }

      if (gridAlpha !== 0) {
        graphics.lineStyle(1, colors.cursorCell, 0.25 * gridAlpha, 0.5, true);
        graphics.moveTo(bounds.left, y + CELL_HEIGHT / 2);
        graphics.lineTo(bounds.left + rowWidth, y + CELL_HEIGHT / 2);
      }

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
    corner.drawRect(bounds.left, bounds.top, rowWidth, cellHeight);
    corner.endFill();
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
  addLabels();
  drawCorner();
  pixiKeyboardCanvasProps.headerSize = {
    width: rowWidth!,
    height: CELL_HEIGHT,
  };
  lastRowSize = { width: rowWidth!, height: CELL_HEIGHT };
}
