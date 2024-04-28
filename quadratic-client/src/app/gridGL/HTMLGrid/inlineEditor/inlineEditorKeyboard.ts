// This handles the keyboard events for the inline editor. In particular, it
// handles when the cursorIsMoving outside of the inline formula edit box.

import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorFormula } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorFormula';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { keyboardPosition } from '@/app/gridGL/interaction/keyboard/keyboardPosition';
import * as monaco from 'monaco-editor';

class InlineEditorKeyboard {
  // Keyboard event for inline editor
  keyDown = (e: monaco.IKeyboardEvent) => {
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
      const target = isRight ? inlineEditorHandler.getLastColumn() : 1;
      if (inlineEditorHandler.isEditingFormula()) {
        if (inlineEditorHandler.cursorIsMoving) {
          keyboardPosition(e.browserEvent);
          e.stopPropagation();
        } else {
          const column = inlineEditorHandler.getCursorColumn();
          if (column === target) {
            inlineEditorHandler.cursorIsMoving = true;
            inlineEditorFormula.addInsertingCells(column);
            keyboardPosition(e.browserEvent);
            e.stopPropagation();
          }
        }
      } else {
        const column = inlineEditorHandler.getCursorColumn();
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
          keyboardPosition(e.browserEvent);
          e.stopPropagation();
        } else {
          const location = inlineEditorHandler.location;
          if (!location) {
            throw new Error('Expected inlineEditorHandler.location to be defined in keyDown');
          }
          const column = inlineEditorHandler.getCursorColumn();
          inlineEditorFormula.addInsertingCells(column);
          inlineEditorHandler.cursorIsMoving = true;
          keyboardPosition(e.browserEvent);
          e.stopPropagation();
        }
      } else {
        inlineEditorHandler.close(0, e.code === 'ArrowDown' ? 1 : -1, false);
        e.stopPropagation();
      }
    }

    // Fallback for all other keys (used to end cursorIsMoving and return
    // control to the formula box)
    else {
      if (inlineEditorHandler.cursorIsMoving) {
        inlineEditorFormula.endInsertingCells();
        this.resetKeyboardPosition();
      }
    }
  };

  // Resets the keyboard position after cursorIsMoving has ended.
  resetKeyboardPosition() {
    const location = inlineEditorHandler.location;
    if (!location) return;

    inlineEditorHandler.cursorIsMoving = false;
    const sheetId = location.sheetId;
    const position = { x: location.x, y: location.y };
    if (sheets.sheet.id !== sheetId) {
      sheets.current = sheetId;
    }
    sheets.sheet.cursor.changePosition({
      cursorPosition: position,
      multiCursor: undefined,
      keyboardMovePosition: position,
      ensureVisible: true,
    });
  }
}

export const inlineEditorKeyboard = new InlineEditorKeyboard();
