import { Action } from '@/app/actions/actions';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';

export function keyboardLink(event: React.KeyboardEvent<HTMLElement>): boolean {
  if (matchShortcut(Action.CmdClick, event)) {
    if (!pixiApp.cellsSheets.current) {
      throw new Error('Expected cellsSheets.current to be defined in PointerLink');
    }
    const world = pixiApp.viewport.getWorld();
    const link = pixiApp.cellsSheets.current.cellsLabels.intersectsLink(world);
    pixiApp.canvas.style.cursor = link ? 'pointer' : 'unset';
  } else {
    pixiApp.canvas.style.cursor = 'unset';
  }
  return false;
}
