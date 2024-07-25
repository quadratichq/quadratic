//! This handles the keyboard events for the inline editor. In particular, it
//! handles when the cursorIsMoving outside of the inline formula edit box.

import { sheets } from '@/app/grid/controller/Sheets';
import { getSingleSelection } from '@/app/grid/sheet/selection';
import { inlineEditorFormula } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorFormula';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { inlineEditorMonaco } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorMonaco';
import { keyboardPosition } from '@/app/gridGL/interaction/keyboard/keyboardPosition';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

class InlineEditorKeyboard {
  escapeBackspacePressed = false;

  // Keyboard event for inline editor (via either Monaco's keyDown event or,
  // when on a different sheet, via window's keyDown listener).
  keyDown = async (e: KeyboardEvent) => {
    if (inlineEditorHandler.cursorIsMoving) {
      this.escapeBackspacePressed = ['Escape', 'Backspace'].includes(e.code);
    } else {
      this.escapeBackspacePressed = false;
    }

    // Escape key
    if (e.code === 'Escape') {
      e.stopPropagation();
      if (inlineEditorHandler.cursorIsMoving) {
        inlineEditorHandler.cursorIsMoving = false;
        inlineEditorFormula.removeInsertingCells();
        this.resetKeyboardPosition();
      } else {
        inlineEditorHandler.close(0, 0, true);
      }
    }

    // Enter key
    else if (e.code === 'Enter') {
      e.stopPropagation();
      inlineEditorHandler.close(0, 1, false);
    }

    // Tab key
    else if (e.code === 'Tab') {
      e.stopPropagation();
      e.preventDefault();
      inlineEditorHandler.close(e.shiftKey ? -1 : 1, 0, false);
    }

    // Horizontal arrow keys
    else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
      const isRight = e.code === 'ArrowRight';
      const target = isRight ? inlineEditorMonaco.getLastColumn() : 1;
      if (inlineEditorHandler.isEditingFormula()) {
        if (inlineEditorHandler.cursorIsMoving) {
          e.stopPropagation();
          await keyboardPosition(e);
        } else {
          const column = inlineEditorMonaco.getCursorColumn();
          if (column === target) {
            // if we're not moving and the formula is valid, close the editor
            e.stopPropagation();
            if (inlineEditorFormula.isFormulaValid()) {
              inlineEditorHandler.close(isRight ? 1 : -1, 0, false);
            } else {
              if (isRight) {
                inlineEditorHandler.cursorIsMoving = true;
                inlineEditorFormula.addInsertingCells(column);
                await keyboardPosition(e);
              }
            }
          }
        }
      } else {
        const column = inlineEditorMonaco.getCursorColumn();
        if (column === target) {
          e.stopPropagation();
          inlineEditorHandler.close(isRight ? 1 : -1, 0, false);
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
        e.stopPropagation();
        e.preventDefault();
        inlineEditorFormula.removeInsertingCells();
        inlineEditorFormula.endInsertingCells();
        this.resetKeyboardPosition();
      }
    }

    // Vertical arrow keys
    else if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
      if (inlineEditorHandler.isEditingFormula()) {
        e.stopPropagation();
        if (inlineEditorHandler.cursorIsMoving) {
          await keyboardPosition(e);
        } else {
          // if we're not moving and the formula is valid, close the editor
          if (inlineEditorFormula.isFormulaValid()) {
            inlineEditorHandler.close(0, e.code === 'ArrowDown' ? 1 : -1, false);
            return;
          }
          const location = inlineEditorHandler.location;
          if (!location) {
            throw new Error('Expected inlineEditorHandler.location to be defined in keyDown');
          }
          const column = inlineEditorMonaco.getCursorColumn();
          inlineEditorFormula.addInsertingCells(column);
          inlineEditorHandler.cursorIsMoving = true;
          await keyboardPosition(e);
        }
      } else {
        e.stopPropagation();
        inlineEditorHandler.close(0, e.code === 'ArrowDown' ? 1 : -1, false);
      }
    }

    // toggle italics
    else if (e.code === 'KeyI' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      inlineEditorHandler.toggleItalics();
      if (inlineEditorHandler.location) {
        const selection = getSingleSelection(
          inlineEditorHandler.location.sheetId,
          inlineEditorHandler.location.x,
          inlineEditorHandler.location.y
        );
        quadraticCore.setCellItalic(selection, !!inlineEditorHandler.temporaryItalic);
      }
    }

    // toggle bold
    else if (e.code === 'KeyB' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      if (inlineEditorHandler.location) {
        inlineEditorHandler.toggleBold();
        const selection = getSingleSelection(
          inlineEditorHandler.location.sheetId,
          inlineEditorHandler.location.x,
          inlineEditorHandler.location.y
        );
        quadraticCore.setCellBold(selection, !!inlineEditorHandler.temporaryBold);
      }
    }

    // trigger cell type menu
    else if (e.code === 'Slash' && inlineEditorMonaco.get().length === 0) {
      e.preventDefault();
      e.stopPropagation();
      pixiAppSettings.changeInput(false);
      const cursor = sheets.sheet.cursor.getCursor();
      pixiAppSettings.setEditorInteractionState?.({
        ...pixiAppSettings.editorInteractionState,
        showCellTypeMenu: true,
        selectedCell: { x: cursor.x, y: cursor.y },
        selectedCellSheet: sheets.sheet.id,
      });
    }
    // Fallback for all other keys (used to end cursorIsMoving and return
    // control to the formula box)
    else {
      // need to ignore meta and control to allow for multi-selection
      if (!['Meta', 'Control'].includes(e.key) && inlineEditorHandler.cursorIsMoving) {
        inlineEditorFormula.endInsertingCells();
        this.resetKeyboardPosition();
        if (sheets.sheet.id !== inlineEditorHandler.location?.sheetId) {
          inlineEditorMonaco.sendKeyboardEvent(e);
          inlineEditorHandler.sendMultiplayerUpdate();
        }
      }
    }
  };

  // Resets the keyboard position after cursorIsMoving has ended.
  resetKeyboardPosition(skipFocus?: boolean) {
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
      multiCursor: null,
      columnRow: null,
      keyboardMovePosition: position,
      ensureVisible: true,
    });
    if (sheets.sheet.id !== location.sheetId) {
      sheets.current = location.sheetId;

      if (!skipFocus) {
        // We need the timeout to wait for the sheet to change (and all events to
        // handle) before we can focus on the inline editor and set cursorIsMoving
        // to false.
        setTimeout(() => {
          inlineEditorMonaco.focus();
        }, 0);
      }
    }
  }
}

export const inlineEditorKeyboard = new InlineEditorKeyboard();
