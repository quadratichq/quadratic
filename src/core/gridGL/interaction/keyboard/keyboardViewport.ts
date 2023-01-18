import { Viewport } from 'pixi-viewport';
import { Sheet } from '../../../gridDB/Sheet';
import { zoomInOut, zoomToFit } from '../../helpers/zoom';

export function keyboardViewport(options: {
  event: KeyboardEvent;
  sheet: Sheet;
  viewport?: Viewport;
  editorInteractionState: any;
  setEditorInteractionState: Function;
}): boolean {
  const { event, sheet, viewport, editorInteractionState, setEditorInteractionState } = options;

  if (!viewport) return false;

  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyP') {
    setEditorInteractionState({
      ...editorInteractionState,
      showCommandPalette: !editorInteractionState.showCommandPalette,
    });
    return true;
  }

  if (event.code === 'Escape') {
    if (editorInteractionState.showCommandPalette) {
      setEditorInteractionState({
        ...editorInteractionState,
        showCommandPalette: !editorInteractionState.showCommandPalette,
      });
    }
  }

  if ((event.metaKey || event.ctrlKey) && event.code === 'Equal') {
    zoomInOut(viewport, viewport.scale.x * 2);
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.code === 'Minus') {
    zoomInOut(viewport, viewport.scale.x * 0.5);
    return true;
  }

  if (event.shiftKey && event.code === 'Digit1') {
    zoomToFit(sheet, viewport);
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.code === 'Digit0') {
    zoomInOut(viewport, 1);
    event.preventDefault();
    return true;
  }

  return false;
}
