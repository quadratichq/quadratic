//! This is an abstraction of the Monaco Editor for use with the inline editor.

import { inlineEditorEvents } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorEvents';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { inlineEditorKeyboard } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorKeyboard';
import { emojiMap } from '@/app/gridGL/pixiApp/emojis/emojiMap';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { CURSOR_THICKNESS } from '@/app/gridGL/UI/Cursor';
import type { CellAlign, CellVerticalAlign, CellWrap } from '@/app/quadratic-core-types';
import { provideCompletionItems, provideHover } from '@/app/quadratic-core/quadratic_core';
import type { SuggestController } from '@/app/shared/types/SuggestController';
import { FormulaLanguageConfig, FormulaTokenizerConfig } from '@/app/ui/menus/CodeEditor/FormulaLanguageModel';
import { FONT_SIZE, LINE_HEIGHT } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellLabel';
import * as monaco from 'monaco-editor';
import { editor } from 'monaco-editor';
import DefaultEditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonEditorWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import TsEditorWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// This is where we globally define worker types for Monaco. See
// https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-esm.md
window.MonacoEnvironment = {
  getWorker(_, label) {
    switch (label) {
      case 'typescript':
      case 'javascript':
        return new TsEditorWorker({ name: label });
      case 'json':
        return new JsonEditorWorker({ name: label });
      default:
        return new DefaultEditorWorker({ name: label });
    }
  },
};

// Pixels needed when growing width to avoid monaco from scrolling the text
// (determined by experimentation).
const PADDING_FOR_GROWING_HORIZONTALLY = 20;

// Padding for the inline editor when calling keepCursorVisible, to keep the editor/cursor in view.
export const PADDING_FOR_INLINE_EDITOR = 5;

class InlineEditorMonaco {
  editor?: editor.IStandaloneCodeEditor;
  private suggestionWidgetShowing: boolean = false;
  private processingEmojiConversion = false;

  // used to populate autocomplete suggestion (dropdown is handled in autocompleteDropDown.tsx)
  autocompleteList?: string[];
  autocompleteShowingList = false;

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

  setShowingList(showing: boolean) {
    this.autocompleteShowingList = showing;
  }

  // Gets the value of the inline editor.
  get = (): string => {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in getValue');
    }
    return this.editor.getValue();
  };

  // Sets the value of the inline editor and moves the cursor to the end.
  set(s: string, select?: boolean | number) {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in setValue');
    }
    this.editor.setValue(s);

    // set the edited value on the div for playwright
    document.querySelector('#cell-edit')?.setAttribute('data-test-value', s);

    this.setColumn(s.length + 1);
    if (select !== undefined && select !== false) {
      const model = this.getModel();
      const lineCount = model.getLineCount();
      const maxColumns = model.getLineMaxColumn(lineCount);
      const range = new monaco.Range(1, select !== true ? select : 1, lineCount, maxColumns);
      this.editor.setSelection(range);
    }
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

  replaceRange(text: string, range: monaco.Range) {
    const model = this.getModel();
    if (!model) {
      throw new Error('Expected model to be defined in replaceRange');
    }
    model.applyEdits([{ range, text }]);
  }

  focus = () => {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in focus');
    }
    inlineEditorHandler.keepCursorVisible();
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
    textWrap: CellWrap,
    underline: boolean,
    strikeThrough: boolean
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

    this.setUnderline(underline);
    this.setStrikeThrough(strikeThrough);

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

    const scrollWidth = textarea.scrollWidth;
    width = textWrap === 'wrap' ? width : Math.max(width, scrollWidth + PADDING_FOR_GROWING_HORIZONTALLY);
    height = Math.max(contentHeight, height);

    const viewportRectangle = pixiApp.getViewportRectangle();
    const maxWidthDueToViewport = viewportRectangle.width - 2 * PADDING_FOR_INLINE_EDITOR;
    if (width > maxWidthDueToViewport) {
      textWrap = 'wrap';
      width = maxWidthDueToViewport;
      this.editor.updateOptions({
        wordWrap: textWrap === 'wrap' ? 'on' : 'off',
        padding: { top: paddingTop, bottom: 0 },
      });
    }

    // set final width and height
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

  /// Returns the text and range of the current selection.
  getSelection(): { text: string; range: monaco.Range } | undefined {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in getSelection');
    }
    if (!this.hasSelection()) {
      return undefined;
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
      return { text: model.getValueInRange(range), range };
    }
    return undefined;
  }

  setBackgroundColor(color: string) {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in setBackgroundColor');
    }
    const styles = this.editor.getDomNode()?.style;
    styles?.setProperty('--vscode-editor-background', color);
  }

  setFontFamily(fontFamily: string) {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in setFontFamily');
    }
    this.editor.updateOptions({ fontFamily });
  }

  setUnderline(underline: boolean) {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in setUnderline');
    }
    const domNode = this.editor.getDomNode();
    if (!domNode) {
      throw new Error('Expected domNode to be defined in setUnderline');
    }
    if (underline && !inlineEditorHandler.formula) {
      domNode.dataset.underline = 'true';
    } else {
      delete domNode.dataset.underline;
    }
  }

  setStrikeThrough(strikeThrough: boolean) {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in setStrikeThrough');
    }
    const domNode = this.editor.getDomNode();
    if (!domNode) {
      throw new Error('Expected domNode to be defined in setUnderline');
    }
    if (strikeThrough && !inlineEditorHandler.formula) {
      domNode.dataset.strikeThrough = 'true';
    } else {
      delete domNode.dataset.strikeThrough;
    }
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

  getPosition = (): monaco.Position => {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in getPosition');
    }
    const position = this.editor.getPosition();
    if (!position) {
      throw new Error('Expected position to be defined in getPosition');
    }
    return position;
  };

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

  getNonWhitespaceCharBeforeCursor = (): string => {
    const formula = this.get();

    // If there is a selection then use the start of the selection; otherwise
    // use the cursor position.
    const selection = this.editor?.getSelection()?.getStartPosition();
    const position = selection ?? this.getPosition();

    const line = formula.split('\n')[position.lineNumber - 1];
    const lastCharacter =
      line
        .substring(0, position.column - 1) // 1-indexed to 0-indexed
        .trimEnd()
        .at(-1) ?? '';
    return lastCharacter;
  };

  /// Returns the text and range of any cell reference at the cursor.
  getReferenceAtCursor(): { text: string; range: monaco.Range } | undefined {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in getReferenceAtCursor');
    }
    const formula = this.get();

    // If there is a selection then check if it's a valid reference
    const selection = this.getSelection();
    if (selection) {
      if (selection.text.match(/^[$A-Za-z0-9']+$/)) {
        return { text: selection.text, range: selection.range };
      }
      return undefined;
    }

    // Otherwise, use regex to find the reference at the cursor position
    else {
      const position = this.getPosition();
      const cursorIndex = Math.max(0, position.column - 2);

      // Use regex to find the complete reference at or around cursor position
      const referenceRegex = /[$A-Za-z0-9']+/g;
      let match;

      while ((match = referenceRegex.exec(formula)) !== null) {
        const start = match.index;
        const end = start + match[0].length;

        // Check if cursor is within this reference
        if (cursorIndex >= start && cursorIndex < end) {
          return {
            text: match[0],
            range: new monaco.Range(position.lineNumber, start + 1, position.lineNumber, end + 1),
          };
        }
      }

      return undefined;
    }
  }

  createDecorationsCollection(newDecorations: editor.IModelDeltaDecoration[]) {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in createDecorationsCollection');
    }
    return this.editor.createDecorationsCollection(newDecorations);
  }

  setLanguage(language: 'Formula' | 'inline-editor') {
    const model = this.getModel();
    editor.setModelLanguage(model, language);
    this.setBracketConfig(language === 'Formula');
    if (this.editor) {
      this.editor.updateOptions({
        quickSuggestions: language === 'Formula' ? true : { other: 'inline' },
        quickSuggestionsDelay: language === 'Formula' ? 10 : 0,
      });
    }
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
      occurrencesHighlight: 'off',
      wordBasedSuggestions: 'off',
      find: {
        addExtraSpaceOnTop: false,
        autoFindInSelection: 'never',
        seedSearchStringFromSelection: 'never',
      },
      fontSize: FONT_SIZE,
      lineHeight: LINE_HEIGHT,
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
      stickyScroll: { enabled: false },
      language: inlineEditorHandler.formula ? 'formula' : 'inline-editor',
    });

    this.disableKeybindings();

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

    monaco.languages.register({ id: 'inline-editor' });
    monaco.languages.registerCompletionItemProvider('inline-editor', {
      provideCompletionItems: (model, position) => {
        if (!this.autocompleteList || !this.autocompleteSuggestionShowing) {
          return;
        }
        const word = model.getWordUntilPosition(position);
        const range = new monaco.Range(position.lineNumber, 1, position.lineNumber, word.endColumn);
        return {
          suggestions: this.autocompleteList.map((text) => ({
            label: text,
            kind: monaco.languages.CompletionItemKind.Text,
            insertText: text,
            range,
          })),
        };
      },
    });

    this.editor.onKeyDown((e) => {
      if (this.suggestionWidgetShowing) return;
      inlineEditorKeyboard.keyDown(e.browserEvent);
    });
    this.editor.onDidChangeCursorPosition(inlineEditorHandler.updateMonacoCursorPosition);
    this.editor.onMouseDown(() => {
      inlineEditorKeyboard.resetKeyboardPosition();
      pixiAppSettings.setInlineEditorState?.((prev) => ({ ...prev, editMode: true }));
    });
    this.editor.onDidChangeModelContent(() => {
      this.convertEmojis();
      inlineEditorEvents.emit('valueChanged', this.get());
    });
  }

  /// Returns true if the autocomplete suggestion is probably showing.
  get autocompleteSuggestionShowing(): boolean {
    if (!this.autocompleteList) return false;
    const lowerCase = this.get().toLowerCase();
    const filteredList = this.autocompleteList?.filter(
      (t) => t.toLowerCase().startsWith(lowerCase) && t.length > lowerCase.length
    );
    return filteredList?.length === 1;
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

  // triggers the inline suggestion for the current text (used when manually entering text)
  triggerSuggestion() {
    if (!this.editor) {
      throw new Error('Expected editor to be defined in triggerSelection');
    }
    this.editor.trigger(null, 'editor.action.inlineSuggest.trigger', null);
  }

  disableKeybindings() {
    editor.addKeybindingRules([
      {
        keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF,
      },
      {
        keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG,
      },
      {
        keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL,
      },
      {
        keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyL,
      },
      {
        keybinding: monaco.KeyCode.F1,
      },
      {
        keybinding: monaco.KeyCode.F3,
      },
      {
        keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.F3,
      },
      {
        keybinding: monaco.KeyMod.Shift | monaco.KeyCode.F3,
      },
      {
        keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.F3,
      },
    ]);
  }

  // Converts emoji shortcodes like :smile: to actual emojis when not in formula mode
  private convertEmojis() {
    // Skip if we're in formula mode or already processing
    if (inlineEditorHandler.formula || this.processingEmojiConversion) {
      return;
    }

    if (!this.editor) {
      return;
    }

    const model = this.getModel();
    const value = model.getValue();
    const position = this.getPosition();

    // Look for completed emoji shortcodes (:name:) before the cursor
    const textBeforeCursor = value.substring(0, model.getOffsetAt(position));

    // Match the last potential emoji shortcode
    const emojiRegex = /:([a-z0-9_-]+):$/;
    const match = textBeforeCursor.match(emojiRegex);

    if (match) {
      const emojiName = match[1];
      const emoji = emojiMap[emojiName as keyof typeof emojiMap];

      if (emoji) {
        // Prevent recursive calls
        this.processingEmojiConversion = true;

        // Calculate the range to replace
        const startOffset = textBeforeCursor.length - match[0].length;
        const endOffset = textBeforeCursor.length;
        const startPosition = model.getPositionAt(startOffset);
        const endPosition = model.getPositionAt(endOffset);
        const range = new monaco.Range(
          startPosition.lineNumber,
          startPosition.column,
          endPosition.lineNumber,
          endPosition.column
        );

        // Replace the shortcode with the emoji
        model.applyEdits([{ range, text: emoji }]);

        // Move cursor to after the emoji
        const newCursorPosition = model.getPositionAt(startOffset + emoji.length);
        this.editor.setPosition(newCursorPosition);

        // Reset the flag after a short delay
        setTimeout(() => {
          this.processingEmojiConversion = false;
        }, 10);
      }
    }
  }
}

export const inlineEditorMonaco = new InlineEditorMonaco();
