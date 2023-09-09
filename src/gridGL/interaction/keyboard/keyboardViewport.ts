import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { sheetController } from '../../../grid/controller/SheetController';
import { clearFormattingAndBorders, setBold, setItalic } from '../../../ui/menus/TopBar/SubMenus/formatCells';
import { zoomIn, zoomOut, zoomTo100, zoomToFit, zoomToSelection } from '../../helpers/zoom';
import { pixiApp } from '../../pixiApp/PixiApp';

export function keyboardViewport(options: {
  event: KeyboardEvent;
  editorInteractionState: EditorInteractionState;
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>;
  presentationMode: boolean;
  setPresentationMode: Function;
}): boolean {
  const { event, editorInteractionState, setEditorInteractionState, presentationMode, setPresentationMode } = options;
  const { pointer } = pixiApp;

  if (event.altKey) return false;

  if ((event.metaKey || event.ctrlKey) && (event.key === 'p' || event.key === 'k' || event.key === '/')) {
    setEditorInteractionState({
      ...editorInteractionState,
      showFeedbackMenu: false,
      showCellTypeMenu: false,
      showGoToMenu: false,
      showCommandPalette: !editorInteractionState.showCommandPalette,
    });
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
    clearFormattingAndBorders();
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
    return pointer.handleEscape();
  }

  if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
    const formatPrimaryCell = sheetController.sheet.getFormatPrimaryCell();
    setBold(!(formatPrimaryCell ? formatPrimaryCell.bold === true : true));
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === 'i') {
    const formatPrimaryCell = sheetController.sheet.getFormatPrimaryCell();
    setItalic(!(formatPrimaryCell ? formatPrimaryCell.italic === true : true));
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
    zoomIn();
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === '-') {
    zoomOut();
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === '8') {
    zoomToSelection();
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === '9') {
    zoomToFit();
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === '0') {
    zoomTo100();
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === 's') {
    // don't do anything on Command+S
    return true;
  }

  return false;
}
