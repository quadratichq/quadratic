import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

export function keyboardUndoRedo(event: React.KeyboardEvent<HTMLElement>): boolean {
  // Redo
  if (matchShortcut('redo', event)) {
    quadraticCore.redo();
    return true;
  }

  // Undo
  if (matchShortcut('undo', event)) {
    quadraticCore.undo();
    return true;
  }

  return false;
}
