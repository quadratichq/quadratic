import { debug } from '@/app/debugFlags';
import { sheets } from '@/app/grid/controller/Sheets.js';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';
import { javascriptWebWorker } from '@/app/web-workers/javascriptWebWorker/javascriptWebWorker.js';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore.js';
import { hasPermissionToEditFile } from '../../../actions';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { clearFormattingAndBorders, setBold, setItalic } from '../../../ui/menus/TopBar/SubMenus/formatCells';
import { pythonWebWorker } from '../../../web-workers/pythonWebWorker/pythonWebWorker';
import { zoomIn, zoomOut, zoomTo100, zoomToFit, zoomToSelection } from '../../helpers/zoom';
import { pixiApp } from '../../pixiApp/PixiApp';

export function keyboardViewport(options: {
  event: React.KeyboardEvent<HTMLElement>;
  editorInteractionState: EditorInteractionState;
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>;
  presentationMode: boolean;
  setPresentationMode: Function;
}): boolean {
  const { event, editorInteractionState, setEditorInteractionState, presentationMode, setPresentationMode } = options;
  const { pointer } = pixiApp;

  // Show command palette
  if (matchShortcut('show_command_palette', event)) {
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

  // Toggle presentation mode
  if (matchShortcut('toggle_presentation_mode', event)) {
    setPresentationMode(!presentationMode);
    return true;
  }

  // Close overlay
  if (matchShortcut('close_overlay', event)) {
    if (presentationMode) {
      setPresentationMode(false);
      return true;
    } else if (editorInteractionState.showCodeEditor) {
      setEditorInteractionState({
        ...editorInteractionState,
        editorEscapePressed: true,
      });
      return true;
    } else if (editorInteractionState.showValidation) {
      // todo: this should check for changes first!!!
      setEditorInteractionState({
        ...editorInteractionState,
        showValidation: false,
      });
      return true;
    }
    return pointer.handleEscape();
  }

  // Show go to menu
  if (matchShortcut('show_go_to_menu', event)) {
    setEditorInteractionState({
      ...editorInteractionState,
      showFeedbackMenu: false,
      showCellTypeMenu: false,
      showCommandPalette: false,
      showGoToMenu: !editorInteractionState.showGoToMenu,
    });
    return true;
  }

  // Zoom in
  if (matchShortcut('zoom_in', event)) {
    zoomIn();
    return true;
  }

  // Zoom out
  if (matchShortcut('zoom_out', event)) {
    zoomOut();
    return true;
  }

  // Zoom to selection
  if (matchShortcut('zoom_to_selection', event)) {
    zoomToSelection();
    return true;
  }

  // Zoom to fit
  if (matchShortcut('zoom_to_fit', event)) {
    zoomToFit();
    return true;
  }

  // Zoom to 100%
  if (matchShortcut('zoom_to_100', event)) {
    zoomTo100();
    return true;
  }

  // Save
  if (matchShortcut('save', event)) {
    // don't do anything on Command+S
    return true;
  }

  // Switch to next sheet
  if (matchShortcut('switch_sheet_next', event)) {
    if (sheets.size > 1) {
      const nextSheet = sheets.getNext(sheets.sheet.order) ?? sheets.getFirst();
      sheets.current = nextSheet.id;
    }
    return true;
  }

  // Switch to previous sheet
  if (matchShortcut('switch_sheet_previous', event)) {
    if (sheets.size > 1) {
      const previousSheet = sheets.getPrevious(sheets.sheet.order) ?? sheets.getLast();
      sheets.current = previousSheet.id;
    }
    return true;
  }

  // All formatting options past here are only available for people with rights
  if (!hasPermissionToEditFile(editorInteractionState.permissions)) {
    return false;
  }

  // Clear formatting and borders
  if (matchShortcut('clear_formatting_borders', event)) {
    clearFormattingAndBorders();
    return true;
  }

  // Toggle bold
  if (matchShortcut('toggle_bold', event)) {
    setBold();
    return true;
  }

  // Toggle italic
  if (matchShortcut('toggle_italic', event)) {
    setItalic();
    return true;
  }

  // Fill right
  // Disabled in debug mode, to allow page reload
  if (!debug && matchShortcut('fill_right', event)) {
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

  // Fill down
  if (matchShortcut('fill_down', event)) {
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

  // Cancel execution
  if (matchShortcut('cancel_execution', event)) {
    pythonWebWorker.cancelExecution();
    javascriptWebWorker.cancelExecution();
  }

  return false;
}
