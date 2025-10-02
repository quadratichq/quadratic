import { Action } from '@/app/actions/actions';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

export function keyboardUndoRedo(event: React.KeyboardEvent<HTMLElement>): boolean {
  // Redo
  if (matchShortcut(Action.Redo, event)) {
    quadraticCore.redo(1, false);
    return true;
  }

  // Undo
  if (matchShortcut(Action.Undo, event)) {
    quadraticCore.undo(1, false);
    return true;
  }

  return false;
}
