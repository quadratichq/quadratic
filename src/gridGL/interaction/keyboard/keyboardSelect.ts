import { Viewport } from 'pixi-viewport';
import { Sheet } from '../../../grid/sheet/Sheet';
import { selectAllCells } from '../../helpers/selectCells';

export function keyboardSelect(options: {
  event: React.KeyboardEvent<HTMLElement>;
  viewport?: Viewport;
  sheet: Sheet;
}): boolean {
  if (!options.viewport) return false;

  // Command + A
  if ((options.event.metaKey || options.event.ctrlKey) && options.event.key === 'a') {
    selectAllCells({
      sheet: options.sheet,
      viewport: options.viewport,
    });
    options.event.preventDefault();
    return true;
  }
  return false;
}
