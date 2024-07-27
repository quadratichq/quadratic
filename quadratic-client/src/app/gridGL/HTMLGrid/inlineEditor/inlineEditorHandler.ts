//! This replaces CellInput.tsx as the inline cell editor for the grid. It uses
//! Monaco Editor to enable proper Formula editor with syntax highlighting and
//! completion.

import mixpanel from 'mixpanel-browser';
import { Rectangle } from 'pixi.js';

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { inlineEditorFormula } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorFormula';
import { inlineEditorKeyboard } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorKeyboard';
import { inlineEditorMonaco } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorMonaco';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type { SheetPosTS } from '@/app/gridGL/types/size';
import { CURSOR_THICKNESS } from '@/app/gridGL/UI/Cursor';
import { convertColorStringToHex } from '@/app/helpers/convertColor';
import { focusGrid } from '@/app/helpers/focusGrid';
import type { CellFormatSummary } from '@/app/quadratic-core-types';
import { createFormulaStyleHighlights } from '@/app/ui/menus/CodeEditor/useEditorCellHighlights';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { googleAnalyticsAvailable } from '@/shared/utils/analytics';

// Minimum amount to scroll viewport when cursor is near the edge.
const MINIMUM_MOVE_VIEWPORT = 50;

class InlineEditorHandler {
  private div?: HTMLDivElement;

  private cellOffsets?: Rectangle;
  private height = 0;
  private open = false;
  private showing = false;

  width = 0;
  location?: SheetPosTS;
  formula: boolean | undefined = undefined;

  cursorIsMoving = false;

  private formatSummary?: CellFormatSummary;
  temporaryBold: boolean | undefined;
  temporaryItalic: boolean | undefined;

  // this is used to display the formula expand button
  private formulaExpandButton?: HTMLDivElement;

  constructor() {
    events.on('changeInput', this.changeInput);
    events.on('changeSheet', this.changeSheet);
    events.on('sheetOffsets', this.sheetOffsets);
    events.on('resizeHeadingColumn', this.sheetOffsets);
    createFormulaStyleHighlights();
  }

  private sheetOffsets = (sheetId: string) => {
    if (this.location?.sheetId === sheetId) {
      this.cellOffsets = sheets.sheet.getCellOffsets(this.location.x, this.location.y);
      if (this.open) {
        this.div?.style.setProperty('left', this.cellOffsets.x + CURSOR_THICKNESS + 'px');
        this.div?.style.setProperty('top', this.cellOffsets.y + 2 + 'px');
        this.height = this.cellOffsets.height - 4;
        this.width = inlineEditorMonaco.resize(this.cellOffsets.width - CURSOR_THICKNESS * 2, this.height);
        pixiApp.cursor.dirty = true;
      }
    }
  };

  // Resets state after editing is complete.
  private reset() {
    this.location = undefined;
    this.temporaryBold = undefined;
    this.temporaryItalic = undefined;
    this.changeToFormula(false);
    this.height = 0;
    this.open = false;
    this.cursorIsMoving = false;
    inlineEditorKeyboard.resetKeyboardPosition();
    inlineEditorFormula.clearDecorations();
    window.removeEventListener('keydown', inlineEditorKeyboard.keyDown);
    multiplayer.sendEndCellEdit();
    pixiApp.cellsSheets.updateCellsArray();
    this.hideDiv();
  }

  // Keeps the cursor visible in the viewport.
  keepCursorVisible = () => {
    if (sheets.sheet.id !== this.location?.sheetId || !this.showing) return;

    const { position, bounds } = inlineEditorMonaco.getEditorSizing();
    const canvas = pixiApp.canvas.getBoundingClientRect();
    const cursor = position.left + bounds.left;
    const worldCursorTop = pixiApp.viewport.toWorld(cursor, bounds.top - canvas.top);
    const worldCursorBottom = pixiApp.viewport.toWorld(cursor, bounds.bottom - canvas.top);
    const viewportBounds = pixiApp.viewport.getVisibleBounds();

    if (
      intersects.rectangleRectangle(
        viewportBounds,
        new Rectangle(
          worldCursorTop.x,
          worldCursorTop.y,
          worldCursorBottom.x - worldCursorTop.x,
          worldCursorBottom.y - worldCursorTop.y
        )
      )
    ) {
      return;
    }

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

  private changeSheet = () => {
    if (!this.div || !this.location || !this.open) return;
    if (this.formula) {
      if (sheets.sheet.id !== this.location.sheetId) {
        this.hideDiv();
        // not sure why this is here
        window.removeEventListener('keydown', inlineEditorKeyboard.keyDown);
        window.addEventListener('keydown', inlineEditorKeyboard.keyDown);
      } else {
        this.showDiv();
        window.removeEventListener('keydown', inlineEditorKeyboard.keyDown);
        this.updateMonacoCursorPosition();
        this.keepCursorVisible();
        inlineEditorMonaco.focus();
      }
      inlineEditorFormula.cursorMoved();
    } else {
      this.close(0, 0, false);
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
      const sheet = sheets.sheet;
      const cursor = sheet.cursor.getCursor();
      this.location = {
        sheetId: sheet.id,
        x: cursor.x,
        y: cursor.y,
      };
      let value: string;
      let changeToFormula = false;
      if (initialValue) {
        value = initialValue;
        this.changeToFormula(value[0] === '=');
      } else {
        const formula = await quadraticCore.getCodeCell(this.location.sheetId, this.location.x, this.location.y);
        if (formula?.language === 'Formula') {
          value = '=' + formula.code_string;
          changeToFormula = true;
        } else {
          value = (await quadraticCore.getEditCell(this.location.sheetId, this.location.x, this.location.y)) || '';
        }
      }
      inlineEditorMonaco.set(value);
      this.formatSummary = await quadraticCore.getCellFormatSummary(
        this.location.sheetId,
        this.location.x,
        this.location.y,
        true
      );
      inlineEditorMonaco.setBackgroundColor(
        this.formatSummary.fillColor ? convertColorStringToHex(this.formatSummary.fillColor) : '#ffffff'
      );
      this.updateFont();
      pixiApp.cellsSheets.updateCellsArray();
      this.sendMultiplayerUpdate();

      this.cellOffsets = sheet.getCellOffsets(this.location.x, this.location.y);
      this.div.style.left = this.cellOffsets.x + CURSOR_THICKNESS + 'px';
      this.div.style.top = this.cellOffsets.y + 2 + 'px';
      this.height = this.cellOffsets.height - 4;
      if (!this.formulaExpandButton) {
        throw new Error('Expected formulaExpandDiv to be defined in InlineEditorHandler');
      }
      this.formulaExpandButton.style.lineHeight = this.height + 'px';
      inlineEditorMonaco.setColumn(value.length + 1);
      this.showDiv();
      this.changeToFormula(changeToFormula);
      this.updateMonacoCursorPosition();
      this.keepCursorVisible();
      inlineEditorMonaco.focus();
    } else {
      this.close(0, 0, false);
    }
  };

  // Sends CellEdit updates to the multiplayer server.
  sendMultiplayerUpdate() {
    multiplayer.sendCellEdit({
      text: inlineEditorMonaco.get(),
      cursor: inlineEditorMonaco.getCursorColumn() - 1,
      codeEditor: false,
      inlineCodeEditor: !!this.formula,
      bold: this.temporaryBold,
      italic: this.temporaryItalic,
    });
  }

  toggleItalics() {
    if (this.temporaryItalic === undefined) {
      this.temporaryItalic = !this.formatSummary?.italic;
    } else {
      this.temporaryItalic = !this.temporaryItalic;
    }
    this.updateFont();
    this.sendMultiplayerUpdate();
  }

  toggleBold() {
    if (this.temporaryBold === undefined) {
      this.temporaryBold = !this.formatSummary?.bold;
    } else {
      this.temporaryBold = !this.temporaryBold;
    }
    this.updateFont();
    this.sendMultiplayerUpdate();
  }

  private updateFont() {
    let fontFamily = 'OpenSans';
    if (!this.formula) {
      const italic = this.temporaryItalic === undefined ? this.formatSummary?.italic : this.temporaryItalic;
      const bold = this.temporaryBold === undefined ? this.formatSummary?.bold : this.temporaryBold;
      if (italic && bold) {
        fontFamily = 'OpenSans-BoldItalic';
      } else if (italic) {
        fontFamily = 'OpenSans-Italic';
      } else if (bold) {
        fontFamily = 'OpenSans-Bold';
      }
    }
    inlineEditorMonaco.setFontFamily(fontFamily);
  }

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

    this.width = inlineEditorMonaco.resize(this.cellOffsets.width - CURSOR_THICKNESS * 2, this.height);
    pixiApp.cursor.dirty = true;

    if (this.formula) {
      inlineEditorFormula.cellHighlights(this.location, value.slice(1));
    }
    this.sendMultiplayerUpdate();
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

    // We need to use visibility instead of display to avoid an annoying warning
    // with <Tooltip>.
    this.formulaExpandButton.style.visibility = formula ? 'visible' : 'hidden';
    this.formulaExpandButton.style.pointerEvents = formula ? 'auto' : 'none';

    if (formula && this.location) {
      inlineEditorFormula.cellHighlights(this.location, inlineEditorMonaco.get().slice(1));
    } else {
      inlineEditorFormula.clearDecorations();
    }
    this.updateFont();
  };

  closeIfOpen() {
    if (this.open) {
      this.close(0, 0, false);
    }
  }

  // Close editor. It saves the value if cancel = false. It also moves the
  // cursor by (deltaX, deltaY).
  close = (deltaX = 0, deltaY = 0, cancel: boolean) => {
    if (!this.location) {
      throw new Error('Expected location to be defined in InlineEditorHandler');
    }
    let value = inlineEditorMonaco.get();

    if (this.cursorIsMoving) {
      inlineEditorKeyboard.resetKeyboardPosition(true);
    } else {
      // Ensure we're on the right sheet so we can show the change
      sheets.current = this.location.sheetId;
    }

    if (!cancel) {
      if (this.formula) {
        const updatedValue = inlineEditorFormula.closeParentheses();
        if (updatedValue) value = updatedValue;
        quadraticCore.setCodeCellValue({
          sheetId: this.location.sheetId,
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
          this.location.sheetId,
          this.location.x,
          this.location.y,
          value.trim(),
          sheets.getCursorPosition()
        );
      }
    }

    this.reset();
    pixiAppSettings.changeInput(false);

    // Update Grid Interaction state, reset input value state
    if (deltaX || deltaY) {
      const position = sheets.sheet.cursor.cursorPosition;
      sheets.sheet.cursor.changePosition({
        multiCursor: null,
        columnRow: null,
        cursorPosition: {
          x: position.x + deltaX,
          y: position.y + deltaY,
        },
        ensureVisible: true,
      });
    }

    // Set focus back to Grid
    focusGrid();
  };

  // Handler for the click for the expand code editor button.
  private openCodeEditor = (e: MouseEvent) => {
    e.stopPropagation();
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
  };

  // Attaches the inline editor to a div created by React in InlineEditor.tsx
  attach(div: HTMLDivElement) {
    // we only want to call this once
    if (!this.div) {
      inlineEditorMonaco.attach(div);
    }
    this.div = div;

    const expandButton = div?.childNodes[1] as HTMLDivElement | undefined;
    if (expandButton) {
      this.formulaExpandButton = expandButton;
      this.formulaExpandButton.removeEventListener('click', this.openCodeEditor);
      this.formulaExpandButton.addEventListener('click', this.openCodeEditor);
    }
    this.hideDiv();
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

  isOpen(): boolean {
    return this.open;
  }

  showDiv() {
    if (!this.div) {
      throw new Error('Expected div to be defined in showDiv');
    }
    // We need to use visibility instead of display to avoid an annoying warning
    // with <Tooltip>.
    this.div.style.visibility = 'visible';
    this.div.style.pointerEvents = 'auto';

    this.showing = true;
  }

  hideDiv() {
    if (!this.div) return;

    // We need to use visibility instead of display to avoid an annoying warning
    // with <Tooltip>.
    this.div.style.visibility = 'hidden';
    this.div.style.pointerEvents = 'none';

    if (this.formulaExpandButton) {
      this.formulaExpandButton.style.visibility = 'hidden';
    }
    this.showing = false;
  }

  // Called when manually changing cell position via clicking on a new cell
  // (except when editing formula).
  handleCellPointerDown() {
    if (this.open) {
      if (!this.formula || inlineEditorFormula.isFormulaValid()) {
        this.close(0, 0, false);
      } else {
        if (!this.cursorIsMoving) {
          this.cursorIsMoving = true;
          inlineEditorFormula.addInsertingCells(inlineEditorMonaco.getCursorColumn());
        }
      }
    }
  }
}

export const inlineEditorHandler = new InlineEditorHandler();
