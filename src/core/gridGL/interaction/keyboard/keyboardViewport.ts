import { Viewport } from 'pixi-viewport';
import { zoomInOut } from '../../helpers/zoom';

export function keyboardViewport(options: { event: KeyboardEvent, viewport?: Viewport }): boolean {
  const { event, viewport } = options;

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

  return false;
}