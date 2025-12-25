import { Action } from '@/app/actions/actions';
import { events } from '@/app/events/events';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';

export function keyboardLink(event: React.KeyboardEvent<HTMLElement>): boolean {
  if (matchShortcut(Action.InsertHyperlink, event)) {
    events.emit('insertLink');
    return true;
  }

  if (matchShortcut(Action.CmdClick, event)) {
    if (!content.cellsSheets.current) {
      throw new Error('Expected cellsSheets.current to be defined in PointerLink');
    }
    const world = pixiApp.viewport.getWorld();
    const link = content.cellsSheets.current.cellsLabels.intersectsLink(world);
    pixiApp.canvas.style.cursor = link ? 'pointer' : 'unset';
  } else {
    pixiApp.canvas.style.cursor = 'unset';
  }
  return false;
}
