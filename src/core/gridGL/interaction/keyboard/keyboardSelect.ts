import { Viewport } from 'pixi-viewport';
import { GridInteractionState } from '../../../../atoms/gridInteractionStateAtom';
import { selectAllCells } from '../../helpers/selectCellsAction';

export function keyboardSelect(options: {
  event: React.KeyboardEvent<HTMLElement>;
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
  viewport?: Viewport;
}): boolean {
  if (!options.viewport) return false;

  // Command + A
  if ((options.event.metaKey || options.event.ctrlKey) && options.event.code === 'KeyA') {
    selectAllCells({
      setInteractionState: options.setInteractionState,
      interactionState: options.interactionState,
      viewport: options.viewport,
    });
    options.event.preventDefault();
    return true;
  }
  return false;
}
