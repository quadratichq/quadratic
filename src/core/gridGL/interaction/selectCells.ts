import { Viewport } from 'pixi-viewport';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { getGridMinMax } from '../../../helpers/getGridMinMax';

export async function selectAllCells(options: {
    setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
    interactionState: GridInteractionState;
    viewport?: Viewport;
}): Promise<void> {
  const bounds = await getGridMinMax();
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
        });

        if (options.viewport) options.viewport.dirty = true;
    }
}