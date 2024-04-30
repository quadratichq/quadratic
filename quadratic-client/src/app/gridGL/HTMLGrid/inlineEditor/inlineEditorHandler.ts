//! This replaces CellInput.tsx as the inline cell editor for the grid. It uses
//! Monaco Editor to enable proper Formula editor with syntax highlighting and
//! completion.

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorFormula } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorFormula';
import { inlineEditorKeyboard } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorKeyboard';
import { inlineEditorMonaco } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorMonaco';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { SheetPosTS } from '@/app/gridGL/types/size';
import { CURSOR_THICKNESS } from '@/app/gridGL/UI/Cursor';
import { convertColorStringToHex } from '@/app/helpers/convertColor';
import { focusGrid } from '@/app/helpers/focusGrid';
import { createFormulaStyleHighlights } from '@/app/ui/menus/CodeEditor/useEditorCellHighlights';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { googleAnalyticsAvailable } from '@/shared/utils/analytics';
import mixpanel from 'mixpanel-browser';
import { Rectangle } from 'pixi.js';

// Pixels needed when growing width to avoid monaco from scrolling the text
// (determined by experimentation).
const PADDING_FOR_GROWING_HORIZONTALLY = 8;

// Minimum amount to scroll viewport when cursor is near the edge.
const MINIMUM_MOVE_VIEWPORT = 50;

class InlineEditorHandler {
  private div?: HTMLDivElement;

  private cellOffsets?: Rectangle;
  private height = 0;
  private open = false;

  width = 0;
  location?: SheetPosTS;
  formula = false;

  cursorIsMoving = false;

  private temporaryBold = false;
  private temporaryItalic = false;

  // this is used to calculate the width of the editor
  private sizingDiv: HTMLDivElement;

  // this is used to display the formula expand button
  private formulaExpandButton?: HTMLDivElement;

  constructor() {
    events.on('changeInput', this.changeInput);
    this.sizingDiv = document.createElement('div');
    this.sizingDiv.style.visibility = 'hidden';
    this.sizingDiv.style.width = 'fit-content';
    this.sizingDiv.style.fontSize = '14px';
    this.sizingDiv.style.fontFamily = 'OpenSans';
    this.sizingDiv.style.paddingLeft = CURSOR_THICKNESS + 'px';
    this.sizingDiv.style.whiteSpace = 'nowrap';

    createFormulaStyleHighlights();
  }

  // Resets state after editing is complete.
  private reset() {
    this.changeToFormula(false);
    this.temporaryBold = false;
    this.temporaryItalic = false;
    this.width = 0;
    this.height = 0;
    this.open = false;
    this.cursorIsMoving = false;
    inlineEditorKeyboard.resetKeyboardPosition();
    inlineEditorFormula.clearDecorations();
  }

  // Keeps the cursor visible in the viewport.
  keepCursorVisible = () => {
    const { position, bounds } = inlineEditorMonaco.getEditorSizing();
    const canvas = pixiApp.canvas.getBoundingClientRect();
    const cursor = position.left + bounds.left;
    const worldCursorTop = pixiApp.viewport.toWorld(cursor, bounds.top - canvas.top);
    const worldCursorBottom = pixiApp.viewport.toWorld(cursor, bounds.bottom - canvas.top);
    const viewportBounds = pixiApp.viewport.getVisibleBounds();
    let x = 0,
      y = 0;
    if (worldCursorTop.x > viewportBounds.right) {
      x = viewportBounds.right - (worldCursorTop.x + MINIMUM_MOVE_VIEWPORT);
    } else if (worldCursorTop.x < viewportBounds.left) {
      x = viewportBounds.left + MINIMUM_MOVE_VIEWPORT - worldCursorTop.x;
    }
    if (worldCursorBottom.y > viewportBounds.bottom) {
      y = viewportBounds.bottom - (worldCursorBottom.y + MINIMUM_MOVE_VIEWPORT);
    } else if (worldCursorTop.y < viewportBounds.top) {
      y = viewportBounds.top + MINIMUM_MOVE_VIEWPORT - worldCursorTop.y;
    }
    if (x || y) {
      pixiApp.viewport.x += x;
      pixiApp.viewport.y += y;
      pixiApp.setViewportDirty();
    }
  };

  // Handler for the changeInput event.
  private changeInput = async (input: boolean, initialValue?: string) => {
    if (!input && !this.open) return;

    if (!this.div) {
      throw new Error('Expected div and editor to be defined in InlineEditorHandler');
    }
    if (input) {
      this.open = true;
      this.div.style.display = 'flex';
      const sheet = sheets.sheet;
      this.location = {
        sheetId: sheet.id,
        x: sheet.cursor.originPosition.x,
        y: sheet.cursor.originPosition.y,
      };
      let value: string;
      if (initialValue) {
        value = initialValue;
      } else {
        const formula = await quadraticCore.getCodeCell(sheets.sheet.id, this.location.x, this.location.y);
        if (formula?.language === 'Formula') {
          value = '=' + formula.code_string;
          this.changeToFormula(true);
        } else {
          value = (await quadraticCore.getEditCell(sheets.sheet.id, this.location.x, this.location.y)) || '';
        }
      }
      inlineEditorMonaco.set(value);
      if (initialValue) {
        inlineEditorMonaco.setColumn(initialValue.length + 1);
      }
      const format = await quadraticCore.getCellFormatSummary(sheets.sheet.id, this.location.x, this.location.y);
      inlineEditorMonaco.setBackgroundColor(format.fillColor ? convertColorStringToHex(format.fillColor) : '#ffffff');
      this.cellOffsets = sheet.getCellOffsets(this.location.x, this.location.y);
      this.div.style.left = this.cellOffsets.x + CURSOR_THICKNESS + 'px';
      this.div.style.top = this.cellOffsets.y + 2 + 'px';
      this.height = this.cellOffsets.height - 4;
      if (!this.formulaExpandButton) {
        throw new Error('Expected formulaExpandDiv to be defined in InlineEditorHandler');
      }
      this.formulaExpandButton.style.height = this.height + 'px';
      this.formulaExpandButton.style.lineHeight = this.height + 'px';
      inlineEditorMonaco.setColumn(value.length + 1);
      this.updateMonacoCursorPosition();
      this.keepCursorVisible();
      inlineEditorMonaco.focus();
    } else {
      this.div.style.display = 'none';
      this.reset();
    }
  };

  // Handles updates to the Monaco editor cursor position
  updateMonacoCursorPosition = () => {
    // this will get called upon opening (before variables are set), and after every cursor movement
    if (!this.div || !this.cellOffsets || !this.location) return;

    const value = inlineEditorMonaco.get();
    if (value[0] === '=') {
      this.changeToFormula(true);
    } else if (this.formula && value[0] !== '=') {
      this.changeToFormula(false);
    }

    // the `|` is important so we get the right height given an empty string
    this.sizingDiv.innerHTML = '|' + value;
    this.width = Math.max(
      this.cellOffsets.width - CURSOR_THICKNESS * 2,
      this.sizingDiv.offsetWidth + PADDING_FOR_GROWING_HORIZONTALLY
    );

    inlineEditorMonaco.resize(this.width, this.height);
    pixiApp.cursor.dirty = true;

    if (this.formula) {
      inlineEditorFormula.cellHighlights(this.location, value.slice(1));
    }
  };

  // Toggle between normal editor and formula editor.
  private changeToFormula = (formula: boolean) => {
    if (this.formula === formula) return;
    if (!this.formulaExpandButton) {
      throw new Error('Expected formulaExpandDiv to be defined in InlineEditorHandler');
    }
    this.formula = formula;
    if (formula) {
      inlineEditorMonaco.setLanguage('Formula');

      // need to show the change to A1 notation
      pixiApp.headings.dirty = true;
    } else {
      inlineEditorMonaco.setLanguage('plaintext');
    }
    this.formulaExpandButton.style.display = formula ? 'block' : 'none';
    if (!this.location) {
      throw new Error('Expected model to be defined in changeToFormula');
    }
    if (formula) {
      inlineEditorFormula.cellHighlights(this.location, inlineEditorMonaco.get().slice(1));
    } else {
      inlineEditorFormula.clearDecorations();
    }
  };

  // Close editor. It saves the value if cancel = false. It also moves the
  // cursor by (deltaX, deltaY).
  close = (deltaX = 0, deltaY = 0, cancel: boolean) => {
    if (!this.location) {
      throw new Error('Expected location to be defined in InlineEditorHandler');
    }
    const value = inlineEditorMonaco.get();

    if (!cancel) {
      if (this.formula) {
        quadraticCore.setCodeCellValue({
          sheetId: sheets.sheet.id,
          x: this.location.x,
          y: this.location.y,
          language: 'Formula',
          codeString: value.slice(1),
          cursor: sheets.getCursorPosition(),
        });
        mixpanel.track('[CodeEditor].cellRun', {
          type: 'Formula',
          inline: true,
        });
        // Google Ads Conversion for running a cell
        if (googleAnalyticsAvailable()) {
          //@ts-expect-error
          gtag('event', 'conversion', {
            send_to: 'AW-11007319783/C-yfCJOe6JkZEOe92YAp',
          });
        }
      } else {
        quadraticCore.setCellValue(
          sheets.sheet.id,
          this.location.x,
          this.location.y,
          value.trim(),
          sheets.getCursorPosition()
        );
      }
    }

    pixiAppSettings.changeInput(false);
    this.reset();

    // Update Grid Interaction state, reset input value state
    const position = sheets.sheet.cursor.cursorPosition;
    sheets.sheet.cursor.changePosition({
      cursorPosition: {
        x: position.x + deltaX,
        y: position.y + deltaY,
      },
    });

    // Set focus back to Grid
    focusGrid();
  };

  // Handler for the click for the expand code editor button.
  private openCodeEditor = (e: MouseEvent) => {
    if (!pixiAppSettings.setEditorInteractionState) {
      throw new Error('Expected setEditorInteractionState to be defined in openCodeEditor');
    }
    if (!this.location) {
      throw new Error('Expected location to be defined in openCodeEditor');
    }
    pixiAppSettings.setEditorInteractionState({
      ...pixiAppSettings.editorInteractionState,
      mode: 'Formula',
      selectedCell: { x: this.location.x, y: this.location.y },
      selectedCellSheet: this.location.sheetId,
      initialCode: inlineEditorMonaco.get().slice(1),
      showCodeEditor: true,
    });
    this.close(0, 0, true);
    e.stopPropagation();

    // todo: open in code editor
  };

  // Attaches the inline editor to a div created by React in InlineEditor.tsx
  attach(div: HTMLDivElement) {
    if (this.div) throw new Error('Inline editor already attached');
    div.style.display = 'none';
    this.div = div;

    inlineEditorMonaco.attach(div);

    document.body.appendChild(this.sizingDiv);
    this.formulaExpandButton = div.childNodes[1]! as HTMLDivElement;
    this.formulaExpandButton.addEventListener('click', this.openCodeEditor);
  }

  // Returns whether we are editing a formula.
  isEditingFormula() {
    return this.open && this.formula;
  }

  // This checks whether the inline editor is showing (or showing at a given location)
  getShowing(x?: number, y?: number): SheetPosTS | undefined {
    if (this.open && (x === undefined || y === undefined || (this.location?.x === x && this.location.y === y))) {
      return this.location;
    }
  }
}

export const inlineEditorHandler = new InlineEditorHandler();
