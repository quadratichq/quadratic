//! This is an abstraction of the Monaco Editor for use with the inline editor.

import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { inlineEditorKeyboard } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorKeyboard';
import { CURSOR_THICKNESS } from '@/app/gridGL/UI/Cursor';
import { provideCompletionItems, provideHover } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { FormulaLanguageConfig, FormulaTokenizerConfig } from '@/app/ui/menus/CodeEditor/FormulaLanguageModel';
import * as monaco from 'monaco-editor';
import { editor } from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

const theme: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {},
};
monaco.editor.defineTheme('inline-editor', theme);

// We are only defining the worker for the editor itself. We may need other
// types down the road, however.
window.MonacoEnvironment = {
  getWorker(_, label) {
    return new editorWorker();
  },
};

class InlineEditorMonaco {
  private editor?: editor.IStandaloneCodeEditor;

  // Helper function to get the model without having to check if editor or model
  // is defined.
  private getModel(): editor.ITextModel {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in getModel');
    }
    const model = this.editor.getModel();
    if (!model) {
      throw new Error('Expected model to be defined in getModel');
    }
    return model;
  }

  // Gets the value of the inline editor.
  get(): string {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in getValue');
    }
    return this.editor.getValue();
  }

  // Sets the value of the inline editor.
  set(s: string) {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in setValue');
    }
    this.editor.setValue(s);
  }

  deleteText(position: number, length: number) {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in deleteText');
    }
    const model = this.editor.getModel();
    if (!model) {
      throw new Error('Expected model to be defined in deleteText');
    }
    const range = new monaco.Range(1, position, 1, position + length);
    model.applyEdits([{ range, text: '' }]);
  }

  focus() {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in focus');
    }
    this.editor.focus();
  }

  resize(width: number, height: number) {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in layout');
    }
    this.editor.layout({ width, height });
  }

  setBackgroundColor(color: string) {
    theme.colors['editor.background'] = color;
    monaco.editor.defineTheme('inline-editor', theme);
  }

  // Changes the column of the cursor in the inline editor
  setColumn(column: number) {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in setColumn');
    }
    this.editor.setPosition({ lineNumber: 1, column });
  }

  // Inserts text at cursor location and returns inserting position.
  insertTextAtCursor(text: string): number {
    const model = this.getModel();
    const column = this.getCursorColumn();
    const range = new monaco.Range(1, column, 1, column);
    model.applyEdits([{ range, text }]);
    this.setColumn(column + text.length);
    return column;
  }

  getLastColumn(): number {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in getLastColumn');
    }
    return this.editor.getValue().length + 1;
  }

  getPosition(): monaco.Position {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in getPosition');
    }
    const position = this.editor.getPosition();
    if (!position) {
      throw new Error('Expected position to be defined in getPosition');
    }
    return position;
  }

  getCursorColumn(): number {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in getCursorColumn');
    }
    const editorPosition = this.editor.getPosition();
    if (!editorPosition) {
      throw new Error('Expected editorPosition to be defined in getCursorColumn');
    }
    return editorPosition.column;
  }

  getSpanPosition(start: number): monaco.Position {
    const model = this.getModel();
    return model.getPositionAt(start);
  }

  // Gets the position and size of the editor for use in inlineEditorHandler.keepCursorVisible.
  getEditorSizing(): { bounds: DOMRect; position: { top: number; left: number; height: number } } {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in getEditorPositioning');
    }
    const editorPosition = this.editor.getPosition();
    if (!editorPosition) {
      throw new Error('Expected editorPosition to be defined in getEditorPositioning');
    }
    const position = this.editor.getScrolledVisiblePosition(editorPosition);
    if (!position) {
      throw new Error('Expected position to be defined in getEditorPositioning');
    }
    const domNode = this.editor.getDomNode();
    if (!domNode) {
      throw new Error('Expected domNode to be defined in getEditorPositioning');
    }
    const bounds = domNode.getBoundingClientRect();
    return { bounds, position };
  }

  createDecorationsCollection(newDecorations: editor.IModelDeltaDecoration[]) {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in createDecorationsCollection');
    }
    return this.editor.createDecorationsCollection(newDecorations);
  }

  setLanguage(language: 'Formula' | 'plaintext') {
    const model = this.getModel();
    editor.setModelLanguage(model, language);
  }

  // Creates the Monaco editor and attaches it to the given div (this should
  // only be called once).
  attach(div: HTMLDivElement) {
    monaco.languages.register({ id: 'Formula' });
    monaco.languages.setLanguageConfiguration('Formula', FormulaLanguageConfig);
    monaco.languages.setMonarchTokensProvider('Formula', FormulaTokenizerConfig);
    monaco.languages.registerCompletionItemProvider('Formula', {
      provideCompletionItems,
    });
    monaco.languages.registerHoverProvider('Formula', { provideHover });

    this.editor = editor.create(div.childNodes[0] as HTMLDivElement, {
      automaticLayout: false,
      readOnly: false,
      renderLineHighlight: 'none',
      // quickSuggestions: false,
      glyphMargin: false,
      lineDecorationsWidth: 0,
      folding: false,
      fixedOverflowWidgets: false,
      revealHorizontalRightPadding: 0,
      disableMonospaceOptimizations: true,
      roundedSelection: false,
      contextmenu: false,
      links: false,
      minimap: { enabled: false },
      overviewRulerLanes: 0,
      cursorWidth: CURSOR_THICKNESS,
      padding: { top: 0, bottom: 0 },
      hideCursorInOverviewRuler: true,
      overviewRulerBorder: false,
      wordWrap: 'off',
      occurrencesHighlight: false,
      wordBasedSuggestions: false,
      find: {
        addExtraSpaceOnTop: false,
        autoFindInSelection: 'never',
        seedSearchStringFromSelection: 'never',
      },
      fontSize: 14,
      lineHeight: 15,
      fontFamily: 'OpenSans',
      fontWeight: 'normal',
      lineNumbers: 'off',
      lineNumbersMinChars: 0,
      scrollBeyondLastColumn: 0,
      scrollBeyondLastLine: false,
      scrollbar: {
        horizontal: 'hidden',
        vertical: 'hidden',
        alwaysConsumeMouseWheel: false,
      },
      theme: 'inline-editor',
      stickyScroll: { enabled: false },
      language: inlineEditorHandler.formula ? 'formula' : undefined,
    });

    this.editor.onDidChangeCursorPosition(inlineEditorHandler.updateCursorPosition);
    this.editor.onKeyDown(inlineEditorKeyboard.keyDown);
    this.editor.onDidChangeCursorPosition(inlineEditorHandler.keepCursorVisible);
  }
}

export const inlineEditorMonaco = new InlineEditorMonaco();
