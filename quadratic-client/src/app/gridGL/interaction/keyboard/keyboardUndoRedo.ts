import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { isMac } from '@/shared/utils/isMac';

export function keyboardUndoRedo(event: React.KeyboardEvent<HTMLElement>): boolean {
  // Redo
  if (
    ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'z') ||
    ((event.metaKey || event.ctrlKey) && event.key === 'y' && !isMac)
  ) {
    quadraticCore.redo();
    return true;
  }

  // Undo
  if ((event.metaKey || event.ctrlKey) && event.key === 'z') {
    quadraticCore.undo();
    return true;
  }

  return false;
}
