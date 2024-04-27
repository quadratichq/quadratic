import { inlineEditorFormula } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorFormula';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
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
      const column = inlineEditorHandler.getCursorColumn();
      if (column === inlineEditorHandler.getLastColumn()) {
      }
    } else if (e.code === 'ArrowDown') {
    }
    inlineEditorFormula.clearDecorations();
  };
}

export const inlineEditorKeyboard = new InlineEditorKeyboard();
