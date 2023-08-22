import { Viewport } from 'pixi-viewport';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { Sheet } from '../../../grid/sheet/Sheet';
import { MultipleFormat } from '../../../ui/menus/TopBar/SubMenus/useGetSelection';
import { zoomIn, zoomOut, zoomTo100, zoomToFit, zoomToSelection } from '../../helpers/zoom';
import { PixiApp } from '../../pixiApp/PixiApp';
import { Pointer } from '../pointer/Pointer';

export function keyboardViewport(options: {
  app: PixiApp;
  event: KeyboardEvent;
  sheet: Sheet;
  viewport?: Viewport;
  interactionState: GridInteractionState;
  editorInteractionState: EditorInteractionState;
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>;
  clearAllFormatting: Function;
  changeBold: Function;
  changeItalic: Function;
  format: MultipleFormat;
  pointer: Pointer;
  presentationMode: boolean;
  setPresentationMode: Function;
}): boolean {
  const {
    changeBold,
    changeItalic,
    clearAllFormatting,
    event,
    format,
    sheet,
    viewport,
    interactionState,
    editorInteractionState,
    setEditorInteractionState,
    presentationMode,
    setPresentationMode,
    app,
  } = options;

  if (!viewport || event.altKey) return false;

  if ((event.metaKey || event.ctrlKey) && (event.key === 'p' || event.key === 'k' || event.key === '/')) {
    setEditorInteractionState({
      ...editorInteractionState,
      showFeedbackMenu: false,
      showCellTypeMenu: false,
      showGoToMenu: false,
      showShareFileMenu: false,
      showCommandPalette: !editorInteractionState.showCommandPalette,
    });
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
    clearAllFormatting();
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === '.') {
    setPresentationMode(!presentationMode);
    return true;
  }

  if (event.key === 'Escape') {
    if (presentationMode) {
      setPresentationMode(false);
      return true;
    }
    return app.pointer.handleEscape();
  }

  if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
    changeBold(!(format.bold === true));
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === 'i') {
    changeItalic(!(format.italic === true));
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && (event.key === 'g' || event.key === 'j')) {
    setEditorInteractionState({
      ...editorInteractionState,
      showFeedbackMenu: false,
      showCellTypeMenu: false,
      showCommandPalette: false,
      showGoToMenu: !editorInteractionState.showGoToMenu,
    });
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === '=') {
    zoomIn(viewport);
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === '-') {
    zoomOut(viewport);
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === '8') {
    zoomToSelection(interactionState, sheet, viewport);
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === '9') {
    zoomToFit(sheet, viewport);
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === '0') {
    zoomTo100(viewport);
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === 's') {
    // don't do anything on Command+S
    return true;
  }

  return false;
}
