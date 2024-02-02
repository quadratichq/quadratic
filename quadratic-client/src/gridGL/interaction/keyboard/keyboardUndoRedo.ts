import { grid } from '../../../grid/controller/Grid';
import { isMac } from '../../../utils/isMac';

export function keyboardUndoRedo(event: React.KeyboardEvent<HTMLElement>): boolean {
  // Redo
  if (
    ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'z') ||
    ((event.metaKey || event.ctrlKey) && event.key === 'y' && !isMac)
  ) {
    grid.redo();
    event.preventDefault();
    return true;
  }

  // Undo
  if ((event.metaKey || event.ctrlKey) && event.key === 'z') {
    grid.undo();
    event.preventDefault();
    return true;
  }

  return false;
}
