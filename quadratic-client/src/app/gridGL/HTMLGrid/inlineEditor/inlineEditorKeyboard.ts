import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { keyboardPosition } from '@/app/gridGL/interaction/keyboard/keyboardPosition';
import * as monaco from 'monaco-editor';

class InlineEditorKeyboard {
  keyDown = (e: monaco.IKeyboardEvent) => {
    if (e.code === 'Escape') {
      inlineEditorHandler.close(0, 0, true);
      e.stopPropagation();
    } else if (e.code === 'Enter') {
      inlineEditorHandler.close(0, 1, false);
      e.stopPropagation();
    } else if (e.code === 'ArrowRight') {
      if (inlineEditorHandler.cursorIsMoving) {
        keyboardPosition(e.browserEvent);
      } else {
        const column = inlineEditorHandler.getCursorColumn();
        if (column === inlineEditorHandler.getLastColumn()) {
          inlineEditorHandler.cursorIsMoving = true;
          keyboardPosition(e.browserEvent);
          e.stopPropagation();
        }
      }
    } else if (e.code === 'ArrowLeft') {
      if (inlineEditorHandler.cursorIsMoving) {
        keyboardPosition(e.browserEvent);
      } else {
        const column = inlineEditorHandler.getCursorColumn();
        if (column === 0) {
          inlineEditorHandler.cursorIsMoving = true;
          keyboardPosition(e.browserEvent);
          e.stopPropagation();
        }
      }
    } else if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
      const location = inlineEditorHandler.location;
      if (!location) {
        throw new Error('Expected inlineEditorHandler.location to be defined in keyDown');
      }
      inlineEditorHandler.cursorIsMoving = true;
      keyboardPosition(e.browserEvent);
      e.stopPropagation();
    }

    if (e.shiftKey && inlineEditorHandler.cursorIsMoving) {
      e.stopPropagation();
    }
  };
}

export const inlineEditorKeyboard = new InlineEditorKeyboard();
