import { sheets } from '@/app/grid/controller/Sheets.js';
import { javascriptWebWorker } from '@/app/web-workers/javascriptWebWorker/javascriptWebWorker.js';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore.js';
import { hasPermissionToEditFile } from '../../../actions';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { clearFormattingAndBorders, setBold, setItalic } from '../../../ui/menus/TopBar/SubMenus/formatCells';
import { pythonWebWorker } from '../../../web-workers/pythonWebWorker/pythonWebWorker';
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

  if (
    ((event.metaKey || event.ctrlKey) && (event.shiftKey || event.altKey) && event.key === 'PageUp') ||
    (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowRight'))
  ) {
    if (sheets.size > 1) {
      const nextSheet = sheets.getNext(sheets.sheet.order) ?? sheets.getFirst();
      sheets.current = nextSheet.id;
    }
    return true;
  }

  if (
    ((event.metaKey || event.ctrlKey) && (event.shiftKey || event.altKey) && event.key === 'PageDown') ||
    (event.altKey && (event.key === 'ArrowDown' || event.key === 'ArrowLeft'))
  ) {
    if (sheets.size > 1) {
      const previousSheet = sheets.getPrevious(sheets.sheet.order) ?? sheets.getLast();
      sheets.current = previousSheet.id;
    }
    return true;
  }

  if (event.altKey) return false;

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

  if ((event.metaKey || event.ctrlKey) && event.key === '.') {
    setPresentationMode(!presentationMode);
    return true;
  }

  if (!(event.metaKey || event.ctrlKey) && event.key === 'Escape') {
    if (presentationMode) {
      setPresentationMode(false);
      return true;
    } else if (editorInteractionState.showCodeEditor) {
      setEditorInteractionState({
        ...editorInteractionState,
        editorEscapePressed: true,
      });
      return true;
    }
    return pointer.handleEscape();
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

  // All formatting options past here are only available for people with rights
  if (!hasPermissionToEditFile(editorInteractionState.permissions)) {
    return false;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
    clearFormattingAndBorders();
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
    setBold();
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === 'i') {
    setItalic();
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === 'r') {
    const cursor = sheets.sheet.cursor;
    if (cursor.columnRow?.all || cursor.columnRow?.rows) return true;
    if (cursor.columnRow?.columns && cursor.multiCursor) return true;
    if (cursor.columnRow?.columns) {
      if (cursor.columnRow.columns.length > 1) return true;
      const column = cursor.columnRow.columns[0];
      const bounds = sheets.sheet.getBounds(false);
      if (!bounds) return true;
      quadraticCore.autocomplete(
        sheets.current,
        column - 1,
        bounds.top,
        column - 1,
        bounds.bottom,
        column - 1,
        bounds.top,
        column,
        bounds.bottom
      );
    } else if (cursor.multiCursor) {
      if (cursor.multiCursor.length > 1) return true;
      const rectangle = cursor.multiCursor[0];
      if (rectangle.width > 1) return true;
      quadraticCore.autocomplete(
        sheets.current,
        rectangle.x - 1,
        rectangle.top,
        rectangle.x - 1,
        rectangle.bottom,
        rectangle.x - 1,
        rectangle.top,
        rectangle.x,
        rectangle.bottom
      );
    } else {
      const position = cursor.cursorPosition;
      quadraticCore.autocomplete(
        sheets.current,
        position.x - 1,
        position.y,
        position.x - 1,
        position.y,
        position.x - 1,
        position.y,
        position.x,
        position.y
      );
    }

    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === 'd') {
    const cursor = sheets.sheet.cursor;
    if (cursor.columnRow?.all || cursor.columnRow?.columns) return true;
    if (cursor.columnRow?.rows && cursor.multiCursor) return true;
    if (cursor.columnRow?.rows) {
      if (cursor.columnRow.rows.length > 1) return true;
      const row = cursor.columnRow.rows[0];
      const bounds = sheets.sheet.getBounds(false);
      if (!bounds) return true;
      quadraticCore.autocomplete(
        sheets.current,
        bounds.left,
        row - 1,
        bounds.right,
        row - 1,
        bounds.left,
        row - 1,
        bounds.right,
        row
      );
    } else if (cursor.multiCursor) {
      if (cursor.multiCursor.length > 1) return true;
      const rectangle = cursor.multiCursor[0];
      if (rectangle.height > 1) return true;
      quadraticCore.autocomplete(
        sheets.current,
        rectangle.left,
        rectangle.top - 1,
        rectangle.right,
        rectangle.top - 1,
        rectangle.left,
        rectangle.top - 1,
        rectangle.right,
        rectangle.top
      );
    } else {
      const position = cursor.cursorPosition;
      quadraticCore.autocomplete(
        sheets.current,
        position.x,
        position.y - 1,
        position.x,
        position.y - 1,
        position.x,
        position.y - 1,
        position.x,
        position.y
      );
    }

    return true;
  }

  // Command + Escape
  if ((event.metaKey || event.ctrlKey) && event.key === 'Escape') {
    pythonWebWorker.cancelExecution();
    javascriptWebWorker.cancelExecution();
  }

  return false;
}
