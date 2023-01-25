import { Viewport } from 'pixi-viewport';
import { Sheet } from '../../../gridDB/Sheet';
import { zoomIn, zoomOut, zoomTo100, zoomToFit } from '../../helpers/zoom';

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

  if ((event.metaKey || event.ctrlKey) && event.code === 'Equal') {
    zoomIn(viewport);
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.code === 'Minus') {
    zoomOut(viewport);
    return true;
  }

  if (event.shiftKey && event.code === 'Digit1') {
    zoomToFit(sheet, viewport);
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.code === 'Digit0') {
    zoomTo100(viewport);
    return true;
  }

  return false;
}
