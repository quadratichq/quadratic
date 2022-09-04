import { Viewport } from 'pixi-viewport';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { CELL_HEIGHT, CELL_WIDTH } from '../../../constants/gridConstants';
import { Size } from '../QuadraticGrid';

// When the cursor moves ensure it is visible
export function ensureVisible(props: {
    interactionState: GridInteractionState,
    viewport: Viewport,
    headerSize: Size,
}): void {
    const { interactionState, viewport, headerSize } = props;
    if (interactionState.showMultiCursor) {
        // todo: maybe zoom to ensure entire cursor range is visible?
    } else {
        let dirty = false;
        if (interactionState.cursorPosition.x * CELL_WIDTH - 1 < viewport.left + headerSize.width) {
            viewport.left = interactionState.cursorPosition.x * CELL_WIDTH - 1 - headerSize.width;
            dirty = true;
        } else if ((interactionState.cursorPosition.x + 1) * CELL_WIDTH + 1 > viewport.right) {
            viewport.right = (interactionState.cursorPosition.x + 1) * CELL_WIDTH + 1;
            dirty = true;
        }

        if (interactionState.cursorPosition.y * CELL_HEIGHT - 1 < viewport.top + headerSize.height / viewport.scale.y) {
            viewport.top = interactionState.cursorPosition.y * CELL_HEIGHT - 1 - headerSize.height / viewport.scale.y;
            dirty = true;
        } else if ((interactionState.cursorPosition.y + 1) * CELL_HEIGHT + 1 > viewport.bottom) {
            viewport.bottom = (interactionState.cursorPosition.y + 1) * CELL_HEIGHT + 1;
            dirty = true;
        }
        if (dirty) {
            viewport.emit('moved');
        }
    }
}