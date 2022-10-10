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
