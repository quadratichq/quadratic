import { Viewport } from 'pixi-viewport';
import { PixiApp } from '../../pixiApp/PixiApp';

export function keyboardUndoRedo(options: {
  event: React.KeyboardEvent<HTMLElement>;
  viewport?: Viewport;
  app?: PixiApp;
}): boolean {
  if (!(options.app && options.event)) return false;

  // Command + Z
  if ((options.event.metaKey || options.event.ctrlKey) && options.event.code === 'KeyZ') {
    console.log('Trigger Undo');
    options.app.grid.controller.undo();

    options.event.preventDefault();
    return true;
  }

  // Command + Y
  if ((options.event.metaKey || options.event.ctrlKey) && options.event.code === 'KeyY') {
    console.log('Trigger Redo');
    options.app.grid.controller.redo();

    options.event.preventDefault();
    return true;
  }
  return false;
}
