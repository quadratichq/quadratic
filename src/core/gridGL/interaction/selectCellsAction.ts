import { Viewport } from 'pixi-viewport';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { getGridColumnMinMax, getGridMinMax, getGridRowMinMax } from '../../../helpers/getGridMinMax';

export async function selectAllCells(options: {
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
  interactionState: GridInteractionState;
  viewport?: Viewport;
  column?: number;
  row?: number;
}): Promise<void> {
  let bounds = options.row !== undefined ? await getGridRowMinMax(options.row) : options.column !== undefined ? await getGridColumnMinMax(options.column) : await getGridMinMax();
  if (!bounds) {
    if (options.row !== undefined) {
      bounds = [{ x: 0, y: options.row }, { x: 0, y: options.row }];
    } else if (options.column !== undefined) {
      bounds = [{ x: options.column, y: 0 }, { x: options.column, y: 0 }];
    } else {
      return;
    }
  }
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

export async function selectColumns(options: {
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
  interactionState: GridInteractionState;
  viewport?: Viewport;
  start: number;
  end: number;
}): Promise<void> {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let x = options.start; x <= options.end; x++) {
    const bounds = await getGridColumnMinMax(x);
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

export async function selectRows(options: {
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
  interactionState: GridInteractionState;
  viewport?: Viewport;
  start: number;
  end: number;
}): Promise<void> {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let y = options.start; y <= options.end; y++) {
    const bounds = await getGridRowMinMax(y);
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