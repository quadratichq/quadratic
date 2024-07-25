import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { isMac } from '@/shared/utils/isMac';

export function keyboardUndoRedo(event: React.KeyboardEvent<HTMLElement>): boolean {
  // Redo
  const key = event.key.toLowerCase();
  if (
    ((event.metaKey || event.ctrlKey) && event.shiftKey && key === 'z') ||
    ((event.metaKey || event.ctrlKey) && key === 'y' && !isMac)
  ) {
    event.preventDefault();
    quadraticCore.redo();
    return true;
  }

  // Undo
  if ((event.metaKey || event.ctrlKey) && key === 'z') {
    event.preventDefault();
    quadraticCore.undo();
    return true;
  }

  return false;
}
