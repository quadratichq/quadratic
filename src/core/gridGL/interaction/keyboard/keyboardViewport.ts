import { Viewport } from 'pixi-viewport';
import { MultipleFormat } from '../../../../ui/menus/TopBar/SubMenus/useGetSelection';
import { Sheet } from '../../../gridDB/Sheet';
import { zoomIn, zoomOut, zoomTo100, zoomToFit } from '../../helpers/zoom';

export function keyboardViewport(options: {
  event: KeyboardEvent;
  sheet: Sheet;
  viewport?: Viewport;
  editorInteractionState: any;
  setEditorInteractionState: Function;
  clearAllFormatting: Function;
  changeBold: Function;
  changeItalic: Function;
  format: MultipleFormat;
}): boolean {
  const {
    changeBold,
    changeItalic,
    clearAllFormatting,
    event,
    format,
    sheet,
    viewport,
    editorInteractionState,
    setEditorInteractionState,
  } = options;

  if (!viewport || event.altKey) return false;

  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyP') {
    setEditorInteractionState({
      ...editorInteractionState,
      showGoToMenu: false,
      showCommandPalette: !editorInteractionState.showCommandPalette,
    });
    return true;
  }
  if ((event.metaKey || event.ctrlKey) && event.code === 'Backslash') {
    clearAllFormatting();
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyB') {
    changeBold(!(format.bold === true));
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyI') {
    changeItalic(!(format.italic === true));
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && (event.code === 'KeyG' || event.code === 'KeyJ')) {
    setEditorInteractionState({
      ...editorInteractionState,
      showCommandPalette: false,
      showGoToMenu: !editorInteractionState.showGoToMenu,
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

  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyS') {
    // don't do anything on Command+S
    return true;
  }

  return false;
}
