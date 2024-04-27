import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorFormula } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorFormula';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { keyboardPosition } from '@/app/gridGL/interaction/keyboard/keyboardPosition';
import * as monaco from 'monaco-editor';

class InlineEditorKeyboard {
  keyDown = (e: monaco.IKeyboardEvent) => {
    if (e.code === 'Escape') {
      if (inlineEditorHandler.cursorIsMoving) {
        inlineEditorHandler.cursorIsMoving = false;
        inlineEditorFormula.removeInsertingCells();
        this.resetKeyboardPosition();
      } else {
        inlineEditorHandler.close(0, 0, true);
      }
      e.stopPropagation();
    } else if (e.code === 'Enter') {
      inlineEditorHandler.close(0, 1, false);
      e.stopPropagation();
    } else if (e.code === 'ArrowRight') {
      if (inlineEditorHandler.isEditingFormula()) {
        if (inlineEditorHandler.cursorIsMoving) {
          keyboardPosition(e.browserEvent);
        } else {
          const column = inlineEditorHandler.getCursorColumn();
          if (column === inlineEditorHandler.getLastColumn()) {
            inlineEditorHandler.cursorIsMoving = true;
            inlineEditorFormula.addInsertingCells(column);
            keyboardPosition(e.browserEvent);
            e.stopPropagation();
          }
        }
      } else {
        const column = inlineEditorHandler.getCursorColumn();
        if (column === inlineEditorHandler.getLastColumn()) {
          inlineEditorHandler.close(1, 0, false);
          e.stopPropagation();
        }
      }
    } else if (e.code === 'ArrowLeft') {
      if (inlineEditorHandler.isEditingFormula()) {
        if (inlineEditorHandler.cursorIsMoving) {
          keyboardPosition(e.browserEvent);
        } else {
          const column = inlineEditorHandler.getCursorColumn();
          if (column === 0) {
            inlineEditorHandler.cursorIsMoving = true;
            inlineEditorFormula.addInsertingCells(0);
            keyboardPosition(e.browserEvent);
            e.stopPropagation();
          }
        }
      } else {
        const column = inlineEditorHandler.getCursorColumn();
        if (column === 0) {
          inlineEditorHandler.close(-1, 0, false);
          e.stopPropagation();
        }
      }
    } else if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
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
  };

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
