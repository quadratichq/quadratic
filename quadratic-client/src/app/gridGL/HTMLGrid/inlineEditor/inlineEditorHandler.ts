import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { SheetPosTS } from '@/app/gridGL/types/size';
import { CURSOR_THICKNESS } from '@/app/gridGL/UI/Cursor';
import { convertColorStringToHex } from '@/app/helpers/convertColor';
import { focusGrid } from '@/app/helpers/focusGrid';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import * as monaco from 'monaco-editor';
import { editor } from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { Rectangle } from 'pixi.js';

window.MonacoEnvironment = {
  getWorker(_, label) {
    return new editorWorker();
  },
};

const theme: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#ff0000',
  },
};
monaco.editor.defineTheme('inline-editor', theme);

class InlineEditorHandler {
  private div?: HTMLDivElement;
  private editor?: editor.IStandaloneCodeEditor;
  private location?: SheetPosTS;
  private cellOffsets?: Rectangle;
  private width = 0;
  private height = 0;

  // this is used to calculate the width of the editor
  private sizingDiv: HTMLDivElement;

  constructor() {
    events.on('changeInput', this.changeInput);
    this.sizingDiv = document.createElement('div');
    // this.sizingDiv.style.visibility = 'hidden';
    this.sizingDiv.style.width = 'fit-content';
    this.sizingDiv.style.fontSize = '14px';
    this.sizingDiv.style.fontFamily = 'OpenSans';
    this.sizingDiv.style.paddingLeft = CURSOR_THICKNESS + 'px';
    this.sizingDiv.style.whiteSpace = 'nowrap';

    // debug options
    this.sizingDiv.style.position = 'absolute';
    this.sizingDiv.style.top = '0';
    this.sizingDiv.style.left = '0';
    this.sizingDiv.style.backgroundColor = 'red';
    this.sizingDiv.style.zIndex = '100000';
    this.sizingDiv.style.color = 'white';
  }

  private changeInput = async (input: boolean) => {
    if (!this.div || !this.editor) {
      throw new Error('Expected div and editor to be defined in InlineEditorHandler');
    }

    if (input) {
      this.div.style.display = 'block';
      const sheet = sheets.sheet;
      this.location = {
        sheetId: sheet.id,
        x: sheet.cursor.originPosition.x,
        y: sheet.cursor.originPosition.y,
      };
      const value = await quadraticCore.getEditCell(sheets.sheet.id, this.location.x, this.location.y);
      this.editor.setValue(value || '');
      const format = await quadraticCore.getCellFormatSummary(sheets.sheet.id, this.location.x, this.location.y);
      theme.colors['editor.background'] = format.fillColor ? convertColorStringToHex(format.fillColor) : '#ffffff';
      monaco.editor.defineTheme('inline-editor', theme);
      this.cellOffsets = sheet.getCellOffsets(this.location.x, this.location.y);
      this.div.style.left = this.cellOffsets.x + CURSOR_THICKNESS + 'px';
      this.div.style.top = this.cellOffsets.y + CURSOR_THICKNESS + 'px';
      this.editor.updateOptions({ lineHeight: this.cellOffsets.height - CURSOR_THICKNESS * 2 });
      this.height = this.cellOffsets.height - CURSOR_THICKNESS * 2;
      this.updateSize();
      this.editor.focus();
    } else {
      this.div.style.display = 'none';
    }
  };

  private updateSize = () => {
    // this will get called upon opening (before variables are set), and after every cursor movement
    if (!this.div || !this.editor || !this.cellOffsets) return;

    this.sizingDiv.innerHTML = ' ' + this.editor.getValue();
    this.width =
      Math.max(this.cellOffsets.width - CURSOR_THICKNESS * 4, this.sizingDiv.offsetWidth) + CURSOR_THICKNESS * 2;
    this.editor.layout({ width: this.width, height: this.height });
  };

  private keyDown = (e: monaco.IKeyboardEvent) => {
    if (e.code === 'Escape') {
      this.close(0, 0, true);
    } else if (e.code === 'Enter') {
      this.close(0, 1, false);
    }
  };

  private close = (deltaX = 0, deltaY = 0, cancel: boolean) => {
    if (!this.editor || !this.location) {
      throw new Error('Expected editor and location to be defined in InlineEditorHandler');
    }

    const value = this.editor.getValue();

    if (!cancel && value.trim()) {
      quadraticCore.setCellValue(sheets.sheet.id, this.location.x, this.location.y, value, sheets.getCursorPosition());
      // setTemporaryBold(undefined);
      // setTemporaryItalic(undefined);
      // textInput.innerText = '';
    }

    // Update Grid Interaction state, reset input value state
    const position = sheets.sheet.cursor.cursorPosition;
    sheets.sheet.cursor.changePosition({
      cursorPosition: {
        x: position.x + deltaX,
        y: position.y + deltaY,
      },
    });

    pixiAppSettings.changeInput(false);

    // Set focus back to Grid
    focusGrid();
  };

  attach(div: HTMLDivElement) {
    if (this.div) throw new Error('Inline editor already attached');
    div.style.display = 'none';
    this.div = div;

    this.editor = editor.create(div, {
      automaticLayout: false,
      value: 'This should be the text that in the cell.',
      readOnly: false,
      renderLineHighlight: 'none',
      quickSuggestions: false,
      glyphMargin: false,
      lineDecorationsWidth: 0,
      folding: false,
      fixedOverflowWidgets: true,
      disableMonospaceOptimizations: true,
      roundedSelection: false,
      contextmenu: false,
      links: false,
      minimap: { enabled: false },
      overviewRulerLanes: 0,
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
      // language: 'javascript',
    });

    document.body.appendChild(this.sizingDiv);

    this.editor.onDidChangeCursorPosition(this.updateSize);
    this.editor.onKeyDown(this.keyDown);
  }
}

export const inlineEditorHandler = new InlineEditorHandler();
