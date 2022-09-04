import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import {
  CELL_WIDTH,
  CELL_HEIGHT,
  LABEL_MAXIMUM_WIDTH_PERCENT,
  LABEL_MAXIMUM_HEIGHT_PERCENT,
  LABEL_PADDING_ROWS,
  GRID_HEADER_FONT_SIZE,
  LABEL_DIGITS_TO_CALCULATE_SKIP,
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

interface LabelData {
  text: string;
  x: number;
  y: number;
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
  const gridAlpha = alphaGridLines(props.viewport);
  const bounds = props.viewport.getVisibleBounds();

  // holds data for horizontal and vertical labels
  const labelData: LabelData[] = [];

  const drawHorizontal = () => {
    if (!characterSize) return;

    // draw bar
    props.graphics.beginFill(colors.headerBackgroundColor);
    props.graphics.drawRect(props.viewport.left, props.viewport.top, props.viewport.width, cellHeight);

    // calculate whether we need to skip numbers
    const xOffset = bounds.left % CELL_WIDTH;
    const leftOffset = bounds.left - xOffset - CELL_WIDTH / 2;
    const rightOffset = bounds.right - xOffset + CELL_WIDTH / 2;
    const labelWidth = LABEL_DIGITS_TO_CALCULATE_SKIP * characterSize.width;
    let mod = 0;
    if (
      labelWidth >
      CELL_WIDTH * props.viewport.scale.x * LABEL_MAXIMUM_WIDTH_PERCENT
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
    const x = bounds.left + rowWidth / 2;
    for (let y = topOffset; y < bottomOffset; y += CELL_HEIGHT) {
      const row = Math.round(y / CELL_HEIGHT - 1);
      if (mod === 0 || row % mod === 0) {
        labelData.push({ text: row.toString(), x, y });
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

  const addLabel = (): PIXI.BitmapText => {
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

  // add labels to headings using cached labels
  const addLabels = () => {
    const available = [...props.labels.children] as PIXI.BitmapText[];
    const leftovers: LabelData[] = [];

    // reuse existing labels that have the same text
    labelData.forEach(data => {
      const index = available.findIndex(label => label.text === data.text);
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

  props.labels.children.forEach((child) => (child.visible = false));
  drawHorizontal();
  drawVertical();
  addLabels();
  drawCorner();
  props.setHeaderSize(rowWidth!, CELL_HEIGHT);
}