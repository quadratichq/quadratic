import { Action } from '@/app/actions/actions';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';

export function keyboardPanMode(event: React.KeyboardEvent<HTMLElement>): boolean {
  const setGridPanMode = pixiAppSettings.setGridPanMode;
  if (!setGridPanMode) {
    throw new Error('Expected setGridPanMode to be defined in keyboardPanMode');
  }

  if (event.type === 'keydown' && matchShortcut(Action.GridPanMode, event)) {
    setGridPanMode((prev) => ({ ...prev, spaceIsDown: true }));
  } else {
    setGridPanMode((prev) => ({ ...prev, spaceIsDown: false }));
  }

  return false;
}
