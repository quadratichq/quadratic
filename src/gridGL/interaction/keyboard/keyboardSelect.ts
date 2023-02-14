import { Viewport } from 'pixi-viewport';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { Sheet } from '../../../grid/sheet/Sheet';
import { selectAllCells } from '../../helpers/selectCells';

export function keyboardSelect(options: {
  event: React.KeyboardEvent<HTMLElement>;
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
  viewport?: Viewport;
  sheet: Sheet;
}): boolean {
  if (!options.viewport) return false;

  // Command + A
  if ((options.event.metaKey || options.event.ctrlKey) && options.event.code === 'KeyA') {
    selectAllCells({
      sheet: options.sheet,
      setInteractionState: options.setInteractionState,
      interactionState: options.interactionState,
      viewport: options.viewport,
    });
    options.event.preventDefault();
    return true;
  }
  return false;
}
