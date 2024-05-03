//! This handles the keyboard events for the inline editor. In particular, it
//! handles when the cursorIsMoving outside of the inline formula edit box.

import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorFormula } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorFormula';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { inlineEditorMonaco } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorMonaco';
import { keyboardPosition } from '@/app/gridGL/interaction/keyboard/keyboardPosition';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';

class InlineEditorKeyboard {
  // Keyboard event for inline editor (via either Monaco's keyDown event or,
  // when on a different sheet, via window's keyDown listener).
  keyDown = (e: KeyboardEvent) => {
    // Escape key
    if (e.code === 'Escape') {
      if (inlineEditorHandler.cursorIsMoving) {
        inlineEditorHandler.cursorIsMoving = false;
        inlineEditorFormula.removeInsertingCells();
        this.resetKeyboardPosition();
      } else {
        inlineEditorHandler.close(0, 0, true);
      }
      e.stopPropagation();
    }

    // Enter key
    else if (e.code === 'Enter') {
      inlineEditorHandler.close(0, 1, false);
      e.stopPropagation();
    }

    // Horizontal arrow keys
    else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
      const isRight = e.code === 'ArrowRight';
      const target = isRight ? inlineEditorMonaco.getLastColumn() : 1;
      if (inlineEditorHandler.isEditingFormula()) {
        if (inlineEditorHandler.cursorIsMoving) {
          keyboardPosition(e);
          e.stopPropagation();
        } else {
          const column = inlineEditorMonaco.getCursorColumn();
          if (column === target) {
            inlineEditorHandler.cursorIsMoving = true;
            inlineEditorFormula.addInsertingCells(column);
            keyboardPosition(e);
            e.stopPropagation();
          }
        }
      } else {
        const column = inlineEditorMonaco.getCursorColumn();
        if (column === target) {
          inlineEditorHandler.close(isRight ? 1 : -1, 0, false);
          e.stopPropagation();
        }
      }
    }

    // handle ShiftKey when cursorIsMoving (do nothing or it adds additional references)
    else if (e.code.includes('Shift')) {
      if (inlineEditorHandler.cursorIsMoving) {
        e.stopPropagation();
      }
    }

    // Backspace key cancels cursorIsMoving and removes any inserted cells.
    else if (e.code === 'Backspace') {
      if (inlineEditorHandler.cursorIsMoving) {
        inlineEditorFormula.removeInsertingCells();
        inlineEditorFormula.endInsertingCells();
        this.resetKeyboardPosition();
        e.stopPropagation();
        e.preventDefault();
      }
    }

    // Vertical arrow keys
    else if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
      if (inlineEditorHandler.isEditingFormula()) {
        if (inlineEditorHandler.cursorIsMoving) {
          keyboardPosition(e);
          e.stopPropagation();
        } else {
          const location = inlineEditorHandler.location;
          if (!location) {
            throw new Error('Expected inlineEditorHandler.location to be defined in keyDown');
          }
          const column = inlineEditorMonaco.getCursorColumn();
          inlineEditorFormula.addInsertingCells(column);
          inlineEditorHandler.cursorIsMoving = true;
          keyboardPosition(e);
          e.stopPropagation();
        }
      } else {
        inlineEditorHandler.close(0, e.code === 'ArrowDown' ? 1 : -1, false);
        e.stopPropagation();
      }
    }

    // toggle italics
    else if (e.code === 'KeyI' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      inlineEditorHandler.toggleItalics();
    }

    // toggle bold
    else if (e.code === 'KeyB' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      inlineEditorHandler.toggleBold();
    }

    // trigger cell type menu
    else if (e.code === 'Slash' && inlineEditorMonaco.get().length === 0) {
      pixiAppSettings.changeInput(false);
      pixiAppSettings.setEditorInteractionState?.({
        ...pixiAppSettings.editorInteractionState,
        showCellTypeMenu: true,
      });
      e.preventDefault();
      e.stopPropagation();
    }
    // Fallback for all other keys (used to end cursorIsMoving and return
    // control to the formula box)
    else {
      if (inlineEditorHandler.cursorIsMoving) {
        inlineEditorHandler.cursorIsMoving = false;
        this.resetKeyboardPosition();
        if (sheets.sheet.id !== inlineEditorHandler.location?.sheetId) {
          inlineEditorMonaco.sendKeyboardEvent(e);
          inlineEditorHandler.sendMultiplayerUpdate();
        }
      }
    }
  };

  // Resets the keyboard position after cursorIsMoving has ended.
  resetKeyboardPosition() {
    const location = inlineEditorHandler.location;
    if (!location) return;

    inlineEditorHandler.cursorIsMoving = false;
    pixiApp.cellHighlights.clearHighlightedCell();
    const editingSheet = sheets.getById(location.sheetId);
    if (!editingSheet) {
      throw new Error('Expected editingSheet to be defined in resetKeyboardPosition');
    }
    const position = { x: location.x, y: location.y };
    editingSheet.cursor.changePosition({
      cursorPosition: position,
      multiCursor: undefined,
      keyboardMovePosition: position,
    });
    if (sheets.sheet.id !== location.sheetId) {
      sheets.current = location.sheetId;

      // We need the timeout to wait for the sheet to change (and all events to
      // handle) before we can focus on the inline editor and set cursorIsMoving
      // to false.
      setTimeout(() => {
        inlineEditorMonaco.focus();
        inlineEditorHandler.cursorIsMoving = false;
      }, 0);
    }
  }
}

export const inlineEditorKeyboard = new InlineEditorKeyboard();
