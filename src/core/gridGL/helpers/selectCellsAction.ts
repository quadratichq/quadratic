import { Viewport } from 'pixi-viewport';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { Sheet } from '../../gridDB/Sheet';
import { Coordinate } from '../types/size';

export function selectAllCells(options: {
  sheet: Sheet;
  setInteractionState: (value: GridInteractionState) => void;
  interactionState: GridInteractionState;
  viewport?: Viewport;
  column?: number;
  row?: number;
}): void {
  const { sheet } = options;
  let bounds: Coordinate[] | undefined;
  if (options.row !== undefined) {
    bounds = sheet.getGridRowMinMax(options.row);
  } else if (options.column !== undefined) {
    bounds = sheet.getGridColumnMinMax(options.column);
  } else {
    bounds = sheet.getMinMax();
  }
  if (!bounds) return;
  const cursorPosition = { x: bounds[0].x, y: bounds[0].y };
  if (bounds !== undefined) {
    options.setInteractionState({
      ...options.interactionState,
      ...{
        multiCursorPosition: {
          originPosition: bounds[0],
          terminalPosition: bounds[1],
        },
        showMultiCursor: true,
      },
      cursorPosition,
    });
    if (options.viewport) options.viewport.dirty = true;
  }
}

export function selectColumns(options: {
  sheet: Sheet;
  setInteractionState: (value: GridInteractionState) => void;
  interactionState: GridInteractionState;
  viewport?: Viewport;
  start: number;
  end: number;
}): void {
  const { sheet } = options;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let x = options.start; x <= options.end; x++) {
    const bounds = sheet.getGridColumnMinMax(x);
    if (bounds) {
      minX = Math.min(minX, bounds[0].x);
      maxX = Math.max(maxX, bounds[1].x);
      minY = Math.min(minY, bounds[0].y);
      maxY = Math.max(maxY, bounds[1].y);
    }
  }
  if (minX !== Infinity && minY !== Infinity) {
    options.setInteractionState({
      ...options.interactionState,
      ...{
        multiCursorPosition: {
          originPosition: { x: minX, y: minY },
          terminalPosition: { x: maxX, y: maxY },
        },
        showMultiCursor: true,
      },
    });
    if (options.viewport) options.viewport.dirty = true;
  }
}

export async function selectRows(options: {
  sheet: Sheet;
  setInteractionState: (value: GridInteractionState) => void;
  interactionState: GridInteractionState;
  viewport?: Viewport;
  start: number;
  end: number;
}): Promise<void> {
  const { sheet } = options;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let y = options.start; y <= options.end; y++) {
    const bounds = sheet.getGridRowMinMax(y);
    if (bounds) {
      minX = Math.min(minX, bounds[0].x);
      maxX = Math.max(maxX, bounds[bounds.length - 1].x);
      minY = Math.min(minY, bounds[0].y);
      maxY = Math.max(maxY, bounds[bounds.length - 1].y);
    }
  }
  if (minX !== Infinity && minY !== Infinity) {
    options.setInteractionState({
      ...options.interactionState,
      ...{
        multiCursorPosition: {
          originPosition: { x: minX, y: minY },
          terminalPosition: { x: maxX, y: maxY },
        },
        showMultiCursor: true,
      },
    });
    if (options.viewport) options.viewport.dirty = true;
  }
}
