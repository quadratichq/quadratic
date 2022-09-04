import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import {
  CELL_WIDTH,
  CELL_HEIGHT,
  LABEL_MAXIMUM_WIDTH_PERCENT,
  LABEL_MAXIMUM_HEIGHT_PERCENT,
  LABEL_PADDING_ROWS,
  GRID_HEADER_FONT_SIZE,
} from '../../../constants/gridConstants';
import { colors } from '../../../theme/colors';
import { alphaGridLines } from './gridUtils';

interface IProps {
  viewport: Viewport;
  graphics: PIXI.Graphics;
  labels: PIXI.Container
  corner: PIXI.Graphics;
  setHeaderSize: (width: number, height: number) => void;
  showHeadings: boolean;
}

let characterSize: { width: number, height: number } | undefined = undefined;

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

export function gridHeadings(props: IProps) {
  if (!props.showHeadings) return;
  if (!characterSize) {
      calculateCharacterSize();
  }
  const cellWidth = CELL_WIDTH / props.viewport.scale.x;
  const cellHeight = CELL_HEIGHT / props.viewport.scale.x;
  const inverseScale = 1 / props.viewport.scale.x;

  props.labels.children.forEach((child) => (child.visible = false));

  const gridAlpha = alphaGridLines(props.viewport);

  // caches labels so we can reuse them on rerender
  let labelIndex = 0;

  const bounds = props.viewport.getVisibleBounds();

  const getLabel = (): PIXI.BitmapText => {
    if (labelIndex < props.labels.children.length) {
      const label = props.labels.children[labelIndex];
      labelIndex++;
      label.visible = true;
      return label as PIXI.BitmapText;
    } else {
      const label = props.labels.addChild(
        new PIXI.BitmapText('', {
          fontName: 'OpenSans',
          fontSize: GRID_HEADER_FONT_SIZE,
          tint: 0x55606b,
        })
      );
      label.anchor.set(0.5);
      return label;
    }
  };

  const drawHorizontal = () => {
    if (!characterSize) return;

    // draw bar
    props.graphics.beginFill(colors.headerBackgroundColor);
    props.graphics.drawRect(props.viewport.left, props.viewport.top, props.viewport.width, cellHeight);

    // calculate whether we need to skip numbers
    const xOffset = bounds.left % CELL_WIDTH;
    const leftOffset = bounds.left - xOffset - CELL_WIDTH / 2;
    const rightOffset = bounds.right - xOffset + CELL_WIDTH / 2;
    const leftNumberLength = Math.round(
      leftOffset / CELL_WIDTH - 1
    ).toString().length;
    const rightNumberLength = Math.round(
      rightOffset / CELL_WIDTH - 1
    ).toString().length;
    const largestWidth =
      Math.max(leftNumberLength, rightNumberLength) * characterSize.width;
    let mod = 0;
    if (
      largestWidth >
      CELL_WIDTH * props.viewport.scale.x * LABEL_MAXIMUM_WIDTH_PERCENT
    ) {
      const skipNumbers = Math.ceil(
        (cellWidth * (1 - LABEL_MAXIMUM_WIDTH_PERCENT)) / largestWidth
      );
      mod = findInterval(skipNumbers);
    }

    // create labels
    for (let x = leftOffset; x < rightOffset; x += CELL_WIDTH) {
      const column = Math.round(x / CELL_WIDTH - 1);
      if (mod === 0 || column % mod === 0) {
        const label = getLabel();
        label.text = column.toString();
        label.position.set(x, bounds.top + cellHeight / 2);
        label.scale.set(inverseScale);
      }
      if (gridAlpha !== false) {
        props.graphics.lineStyle(1, colors.cursorCell, 0.25 * gridAlpha, 0.5, true);
        props.graphics.moveTo(x - CELL_WIDTH / 2, bounds.top);
        props.graphics.lineTo(x - CELL_WIDTH / 2, bounds.top + cellHeight);
      }
    }
  };

  let rowWidth: number;
  const drawVertical = () => {
    if (!characterSize) return;

    // determine width of row header
    const yOffset = bounds.top % CELL_HEIGHT;
    const topOffset = bounds.top - yOffset - CELL_HEIGHT / 2;
    const bottomOffset = bounds.bottom - yOffset - CELL_HEIGHT / 2;
    const topNumberLength = Math.round(topOffset / CELL_HEIGHT - 1).toString()
      .length;
    const bottomNumberLength = Math.round(
      bottomOffset / CELL_HEIGHT - 1
    ).toString().length;
    rowWidth =
      (Math.max(topNumberLength, bottomNumberLength) * characterSize.width) /
        props.viewport.scale.x +
      (LABEL_PADDING_ROWS / props.viewport.scale.x) * 2;
    rowWidth = Math.max(rowWidth, CELL_HEIGHT / props.viewport.scale.x);
    props.graphics.lineStyle(0);
    props.graphics.beginFill(colors.headerBackgroundColor);
    props.graphics.drawRect(
      bounds.left,
      bounds.top + CELL_HEIGHT / props.viewport.scale.x,
      rowWidth,
      bounds.height - CELL_HEIGHT / props.viewport.scale.x
    );
    let mod = 0;
    if (
      characterSize.height >
      CELL_HEIGHT * props.viewport.scale.x * LABEL_MAXIMUM_HEIGHT_PERCENT
    ) {
      const skipNumbers = Math.ceil(
        (cellHeight * (1 - LABEL_MAXIMUM_HEIGHT_PERCENT)) /
          characterSize.height
      );
      mod = findInterval(skipNumbers);
    }
    for (let y = topOffset; y < bottomOffset; y += CELL_HEIGHT) {
      const row = Math.round(y / CELL_HEIGHT - 1);
      if (mod === 0 || row % mod === 0) {
        const label = getLabel();
        label.text = row.toString();
        label.position.set(bounds.left + rowWidth / 2, y);
        label.scale.set(inverseScale);
      }
      if (gridAlpha !== false) {
        props.graphics.lineStyle(1, colors.cursorCell, 0.25 * gridAlpha, 0.5, true);
        props.graphics.moveTo(bounds.left, y + CELL_HEIGHT / 2);
        props.graphics.lineTo(bounds.left + rowWidth, y + CELL_HEIGHT / 2);
      }
    }
  };

  const drawCorner = () => {
    props.corner.clear();
    props.corner.beginFill(colors.headerCornerBackgroundColor);
    props.corner.drawRect(bounds.left, bounds.top, rowWidth, cellHeight);
    props.corner.endFill();
  };

  drawHorizontal();
  drawVertical();
  drawCorner();
  props.setHeaderSize(rowWidth!, CELL_HEIGHT);
}