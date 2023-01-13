import { Viewport } from 'pixi-viewport';
import { Sheet } from '../../../gridDB/Sheet';
import { zoomInOut, zoomToFit } from '../../helpers/zoom';

export function keyboardViewport(options: { event: KeyboardEvent; sheet: Sheet; viewport?: Viewport }): boolean {
  const { event, sheet, viewport } = options;

  if (!viewport) return false;

  if ((event.metaKey || event.ctrlKey) && event.code === 'Equal') {
    zoomInOut(viewport, viewport.scale.x * 2);
    event.preventDefault();
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.code === 'Minus') {
    zoomInOut(viewport, viewport.scale.x * 0.5);
    event.preventDefault();
    return true;
  }

  if (event.shiftKey && event.code === 'Digit1') {
    zoomToFit(sheet, viewport);
    event.preventDefault();
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.code === 'Digit0') {
    zoomInOut(viewport, 1);
    event.preventDefault();
    return true;
  }

  return false;
}
