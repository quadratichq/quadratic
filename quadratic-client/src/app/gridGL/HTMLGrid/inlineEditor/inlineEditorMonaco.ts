//! This is an abstraction of the Monaco Editor for use with the inline editor.

import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { inlineEditorKeyboard } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorKeyboard';
import { CURSOR_THICKNESS } from '@/app/gridGL/UI/Cursor';
import { CellAlign, CellVerticalAlign, CellWrap } from '@/app/quadratic-core-types';
import { provideCompletionItems, provideHover } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { FormulaLanguageConfig, FormulaTokenizerConfig } from '@/app/ui/menus/CodeEditor/FormulaLanguageModel';
import * as monaco from 'monaco-editor';
import { editor } from 'monaco-editor';
import DefaultEditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import TsEditorWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

const theme: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {},
};
monaco.editor.defineTheme('inline-editor', theme);

// This is where we globally define worker types for Monaco. See
// https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-esm.md
window.MonacoEnvironment = {
  getWorker(_, label) {
    switch (label) {
      case 'typescript':
      case 'javascript':
        return new TsEditorWorker({ name: label });
      default:
        return new DefaultEditorWorker({ name: label });
    }
  },
};

// Pixels needed when growing width to avoid monaco from scrolling the text
// (determined by experimentation).
const PADDING_FOR_GROWING_HORIZONTALLY = 20;

class InlineEditorMonaco {
  private editor?: editor.IStandaloneCodeEditor;
  private suggestionWidgetShowing: boolean = false;

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

  // Sets the value of the inline editor and moves the cursor to the end.
  set(s: string) {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in setValue');
    }
    this.editor.setValue(s);
    this.setColumn(s.length + 1);
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

  focus = () => {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in focus');
    }
    this.editor.focus();
  };

  // Resizes the editor to the given width and height,
  // and sets the text alignment and wrap.
  // Returns the final width and height of the editor.
  updateTextLayout = (
    width: number,
    height: number,
    textAlign: CellAlign,
    verticalAlign: CellVerticalAlign,
    textWrap: CellWrap
  ): { width: number; height: number } => {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in layout');
    }
    const domNode = this.editor.getDomNode();
    if (!domNode) {
      throw new Error('Expected domNode to be defined in layout');
    }
    const textarea = domNode.querySelector('textarea');
    if (!textarea) {
      throw new Error('Expected textarea to be defined in layout');
    }

    // configure editor options and default layout
    this.editor.updateOptions({
      padding: { top: 0, bottom: 0 },
    });

    // horizontal text alignment
    domNode.dataset.textAlign = textAlign;

    // vertical text alignment
    const contentHeight = this.editor.getContentHeight();
    let paddingTop = 0;
    if (verticalAlign === 'middle') {
      paddingTop = Math.max((height - contentHeight) / 2, 0);
    } else if (verticalAlign === 'bottom') {
      paddingTop = Math.max(height - contentHeight, 0);
    }

    // set text wrap and padding for vertical text alignment
    this.editor.updateOptions({
      wordWrap: textWrap === 'wrap' ? 'on' : 'off',
      padding: { top: paddingTop, bottom: 0 },
    });

    // set final width and height
    const scrollWidth = textarea.scrollWidth;
    width = textWrap === 'wrap' ? width : Math.max(width, scrollWidth + PADDING_FOR_GROWING_HORIZONTALLY);
    height = Math.max(contentHeight, height);
    this.editor.layout({ width, height });

    return { width, height };
  };

  removeSelection() {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in removeSelection');
    }
    const selection = this.editor.getSelection();
    if (selection) {
      const range = new monaco.Range(
        selection.startLineNumber,
        selection.getStartPosition().column,
        selection.endLineNumber,
        selection.getEndPosition().column
      );
      const model = this.getModel();
      model.applyEdits([{ range, text: '' }]);
    }
  }

  setBackgroundColor(color: string) {
    theme.colors['editor.background'] = color;
    monaco.editor.defineTheme('inline-editor', theme);
  }

  setFontFamily(fontFamily: string) {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in setFontFamily');
    }
    this.editor.updateOptions({ fontFamily });
  }

  // Changes the column of the cursor in the inline editor
  setColumn(column: number) {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in setColumn');
    }
    const { lineNumber } = this.getPosition();
    this.editor.setPosition({ lineNumber, column });
    this.editor.layout();
  }

  // set bracket highlighting and auto closing behavior
  setBracketConfig(enabled: boolean) {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in getModel');
    }
    this.editor.updateOptions({
      autoClosingBrackets: enabled ? 'always' : 'never',
      matchBrackets: enabled ? 'always' : 'never',
    });

    const model = this.getModel();
    model.updateOptions({
      bracketColorizationOptions: {
        enabled,
        independentColorPoolPerBracketType: enabled,
      },
    });
  }

  // Inserts text at cursor location and returns inserting position.
  insertTextAtCursor(text: string): number {
    const model = this.getModel();
    const { lineNumber } = this.getPosition();
    const column = this.getCursorColumn();
    const range = new monaco.Range(lineNumber, column, lineNumber, column);
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
    const position = this.editor.getPosition();
    if (!position) {
      throw new Error('Expected editorPosition to be defined in getCursorColumn');
    }
    return position.column;
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

  getNonWhitespaceCharBeforeCursor(): string {
    const formula = inlineEditorMonaco.get();

    // If there is a selection then use the start of the selection; otherwise
    // use the cursor position.
    const selection = inlineEditorMonaco.editor?.getSelection()?.getStartPosition();
    const position = selection ?? inlineEditorMonaco.getPosition();

    const line = formula.split('\n')[position.lineNumber - 1];
    const lastCharacter =
      line
        .substring(0, position.column - 1) // 1-indexed to 0-indexed
        .trimEnd()
        .at(-1) ?? '';
    return lastCharacter;
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
    this.setBracketConfig(language === 'Formula');
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
      renderWhitespace: 'all',
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
      cursorWidth: CURSOR_THICKNESS,
      padding: { top: 0, bottom: 0 },
      hideCursorInOverviewRuler: true,
      overviewRulerLanes: 0,
      overviewRulerBorder: false,
      wordWrap: 'off',
      wrappingStrategy: 'advanced',
      wordBreak: 'keepAll',
      occurrencesHighlight: false,
      wordBasedSuggestions: false,
      find: {
        addExtraSpaceOnTop: false,
        autoFindInSelection: 'never',
        seedSearchStringFromSelection: 'never',
      },
      fontSize: 14,
      lineHeight: 16,
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
        verticalScrollbarSize: 0,
      },
      theme: 'inline-editor',
      stickyScroll: { enabled: false },
      language: inlineEditorHandler.formula ? 'formula' : undefined,
    });

    interface SuggestController {
      widget: { value: { onDidShow: (fn: () => void) => void; onDidHide: (fn: () => void) => void } };
    }
    const suggestionWidget = (
      this.editor.getContribution('editor.contrib.suggestController') as SuggestController | null
    )?.widget;
    if (suggestionWidget) {
      suggestionWidget.value.onDidShow(() => {
        this.suggestionWidgetShowing = true;
      });
      suggestionWidget.value.onDidHide(() => {
        this.suggestionWidgetShowing = false;
      });
    }

    this.editor.onKeyDown((e) => {
      if (this.suggestionWidgetShowing) return;
      inlineEditorKeyboard.keyDown(e.browserEvent);
    });
    this.editor.onDidChangeCursorPosition(inlineEditorHandler.updateMonacoCursorPosition);
    this.editor.onDidChangeCursorPosition(inlineEditorHandler.keepCursorVisible);
    this.editor.onMouseDown(() => inlineEditorKeyboard.resetKeyboardPosition());
  }

  // Sends a keyboard event to the editor (used when returning
  // to the original sheet after adding cells from another sheet)
  sendKeyboardEvent(e: KeyboardEvent) {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in sendKeyboardEvent');
    }
    this.editor.trigger('keyboard', 'type', e);
  }

  hasSelection(): boolean {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in hasSelection');
    }
    const selection = this.editor.getSelection();
    return selection ? !selection.isEmpty() : false;
  }
}

export const inlineEditorMonaco = new InlineEditorMonaco();
