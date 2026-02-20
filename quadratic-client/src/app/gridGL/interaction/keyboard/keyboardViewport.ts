import { hasPermissionToEditFile } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import { viewActionsSpec } from '@/app/actions/viewActionsSpec';
import { debugFlag } from '@/app/debugFlags/debugFlags';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets.js';
import { zoomIn, zoomOut, zoomTo100, zoomToFit, zoomToSelection } from '@/app/gridGL/helpers/zoom';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { isAiDisabled } from '@/app/helpers/isEmbed';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';
import {
  clearFormattingAndBorders,
  decreaseFontSize,
  increaseFontSize,
  setBold,
  setItalic,
  setStrikeThrough,
  setUnderline,
} from '@/app/ui/helpers/formatCells';
import { javascriptWebWorker } from '@/app/web-workers/javascriptWebWorker/javascriptWebWorker.js';
import { pythonWebWorker } from '@/app/web-workers/pythonWebWorker/pythonWebWorker';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore.js';

export function keyboardViewport(event: React.KeyboardEvent<HTMLElement>): boolean {
  const { pointer } = pixiApp;
  const {
    editorInteractionState,
    setEditorInteractionState,
    codeEditorState,
    setCodeEditorState,
    gridSettings,
    setGridSettings,
  } = pixiAppSettings;

  if (!setEditorInteractionState) {
    throw new Error('Expected setEditorInteractionState to be defined in keyboardViewport');
  }

  if (!setCodeEditorState) {
    throw new Error('Expected setCodeEditorState to be defined in keyboardViewport');
  }

  if (!setGridSettings) {
    throw new Error('Expected d to be defined in keyboardViewport');
  }

  // Show command palette
  if (matchShortcut(Action.ShowCommandPalette, event)) {
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

  // Toggle global AI chat
  if (matchShortcut(Action.ToggleAIAnalyst, event) && !isAiDisabled) {
    viewActionsSpec[Action.ToggleAIAnalyst].run();
    return true;
  }

  // Toggle presentation mode
  if (matchShortcut(Action.TogglePresentationMode, event)) {
    setGridSettings({ ...gridSettings, presentationMode: !gridSettings.presentationMode });
    return true;
  }

  // Close overlay
  if (matchShortcut(Action.CloseOverlay, event)) {
    // clear copy range if it is showing
    if (content.copy.isShowing()) {
      content.copy.clearCopyRanges();
      return true;
    }

    if (gridSettings.presentationMode) {
      setGridSettings({ ...gridSettings, presentationMode: false });
      return true;
    } else if (codeEditorState.showCodeEditor) {
      setCodeEditorState({
        ...codeEditorState,
        escapePressed: true,
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
  if (matchShortcut(Action.ShowGoToMenu, event)) {
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
  if (matchShortcut(Action.ZoomIn, event)) {
    zoomIn();
    return true;
  }

  // Zoom out
  if (matchShortcut(Action.ZoomOut, event)) {
    zoomOut();
    return true;
  }

  // Zoom to selection
  if (matchShortcut(Action.ZoomToSelection, event)) {
    zoomToSelection();
    return true;
  }

  // Zoom to fit
  if (matchShortcut(Action.ZoomToFit, event)) {
    zoomToFit();
    return true;
  }

  // Zoom to 100%
  if (matchShortcut(Action.ZoomTo100, event)) {
    zoomTo100();
    return true;
  }

  // Save
  if (matchShortcut(Action.Save, event)) {
    // don't do anything on Command+S
    return true;
  }

  // Switch to next sheet
  if (matchShortcut(Action.SwitchSheetNext, event)) {
    if (sheets.size > 1) {
      const nextSheet = sheets.getNext(sheets.sheet.order) ?? sheets.getFirst();
      sheets.current = nextSheet.id;
    }
    return true;
  }

  // Switch to previous sheet
  if (matchShortcut(Action.SwitchSheetPrevious, event)) {
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
  if (matchShortcut(Action.ClearFormattingBorders, event)) {
    clearFormattingAndBorders();
    return true;
  }

  // Toggle bold
  if (matchShortcut(Action.ToggleBold, event)) {
    setBold();
    return true;
  }

  // Toggle italic
  if (matchShortcut(Action.ToggleItalic, event)) {
    setItalic();
    return true;
  }

  // Toggle underline
  if (matchShortcut(Action.ToggleUnderline, event)) {
    setUnderline();
    return true;
  }

  // Toggle strike-through
  if (matchShortcut(Action.ToggleStrikeThrough, event)) {
    setStrikeThrough();
    return true;
  }

  // Increase font size
  if (matchShortcut(Action.FormatFontSizeIncrease, event)) {
    increaseFontSize();
    events.emit('formatButtonKeyboard', Action.FormatFontSizeIncrease);
    return true;
  }

  // Decrease font size
  if (matchShortcut(Action.FormatFontSizeDecrease, event)) {
    decreaseFontSize();
    events.emit('formatButtonKeyboard', Action.FormatFontSizeDecrease);
    return true;
  }

  // Fill right
  // Disabled in debug mode, to allow page reload
  if (
    (!debugFlag('debug') && matchShortcut(Action.FillRight, event)) ||
    (debugFlag('debug') && event.ctrlKey && event.key === 'r')
  ) {
    const cursor = sheets.sheet.cursor;
    const rect = cursor.getSingleRectangleOrCursor();
    if (rect) {
      if (rect.width === 1) {
        quadraticCore.autocomplete(
          sheets.current,
          rect.left - 1,
          rect.top,
          rect.left - 1,
          rect.bottom - 1,
          rect.left,
          rect.top,
          rect.left,
          rect.bottom - 1,
          false
        );
      } else {
        quadraticCore.autocomplete(
          sheets.current,
          rect.left,
          rect.top,
          rect.left,
          rect.bottom - 1,
          rect.left + 1,
          rect.top,
          rect.right - 1,
          rect.bottom - 1,
          false
        );
      }
    }

    return true;
  }

  // Fill down
  if (matchShortcut(Action.FillDown, event)) {
    const cursor = sheets.sheet.cursor;
    const rect = cursor.getSingleRectangleOrCursor();
    if (rect) {
      if (rect.height === 1) {
        quadraticCore.autocomplete(
          sheets.current,
          rect.left,
          rect.top - 1,
          rect.right - 1,
          rect.top - 1,
          rect.left,
          rect.top,
          rect.right - 1,
          rect.top,
          false
        );
      } else {
        quadraticCore.autocomplete(
          sheets.current,
          rect.left,
          rect.top,
          rect.right - 1,
          rect.top,
          rect.left,
          rect.top + 1,
          rect.right - 1,
          rect.bottom - 1,
          false
        );
      }
    }

    return true;
  }

  // Cancel execution
  if (matchShortcut(Action.CancelExecution, event)) {
    pythonWebWorker.cancelExecution();
    javascriptWebWorker.cancelExecution();
  }

  return false;
}
