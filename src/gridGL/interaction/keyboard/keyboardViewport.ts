import { Viewport } from 'pixi-viewport';
import { MultipleFormat } from '../../../ui/menus/TopBar/SubMenus/useGetSelection';
import { Sheet } from '../../../grid/sheet/Sheet';
import { zoomIn, zoomOut, zoomTo100, zoomToFit, zoomToSelection } from '../../helpers/zoom';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { Pointer } from '../pointer/Pointer';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { LocalFiles } from '../../../ui/contexts/LocalFiles';
import { PixiApp } from '../../pixiApp/PixiApp';

export function keyboardViewport(options: {
  app: PixiApp;
  event: KeyboardEvent;
  sheet: Sheet;
  viewport?: Viewport;
  interactionState: GridInteractionState;
  editorInteractionState: EditorInteractionState;
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>;
  clearAllFormatting: Function;
  changeLiveCell: Function;
  changeBold: Function;
  changeItalic: Function;
  format: MultipleFormat;
  pointer: Pointer;
  presentationMode: boolean;
  setPresentationMode: Function;
  currentFileId: LocalFiles['currentFileId'];
}): boolean {
  const {
    changeLiveCell,
    changeBold,
    changeItalic,
    clearAllFormatting,
    currentFileId,
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

  // Should come before other shortcuts (opens file menu)
  if ((event.metaKey || event.ctrlKey) && event.key === 'o') {
    // Toggle visibility but only under certain conditions
    if (!editorInteractionState.showFileMenu) {
      setEditorInteractionState({
        ...editorInteractionState,
        showFileMenu: true,
      });
      return true;
    } else if (editorInteractionState.showFileMenu && currentFileId) {
      setEditorInteractionState({
        ...editorInteractionState,
        showFileMenu: false,
      });
      return true;
    }
    // Return true anyway, to override browser "Open" functionality
    return true;
  }
  // If file menu is open, don't accept any other shortcuts
  if (editorInteractionState.showFileMenu) return false;

  if ((event.metaKey || event.ctrlKey) && (event.key === 'p' || event.key === 'k' || event.key === '/')) {
    setEditorInteractionState({
      ...editorInteractionState,
      showCellTypeMenu: false,
      showGoToMenu: false,
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

  if ((event.metaKey || event.ctrlKey) && event.key === 'l') {
    changeLiveCell(!(format.liveCell === true));
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === 'i') {
    changeItalic(!(format.italic === true));
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && (event.key === 'g' || event.key === 'j')) {
    setEditorInteractionState({
      ...editorInteractionState,
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
