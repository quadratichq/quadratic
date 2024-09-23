//! This replaces CellInput.tsx as the inline cell editor for the grid. It uses
//! Monaco Editor to enable proper Formula editor with syntax highlighting and
//! completion.

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { inlineEditorFormula } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorFormula';
import { inlineEditorKeyboard } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorKeyboard';
import { inlineEditorMonaco } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorMonaco';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { SheetPosTS } from '@/app/gridGL/types/size';
import { CURSOR_THICKNESS } from '@/app/gridGL/UI/Cursor';
import { convertColorStringToHex } from '@/app/helpers/convertColor';
import { focusGrid } from '@/app/helpers/focusGrid';
import { CellFormatSummary } from '@/app/quadratic-core-types';
import { createFormulaStyleHighlights } from '@/app/ui/menus/CodeEditor/useEditorCellHighlights';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { OPEN_SANS_FIX } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellLabel';
import { googleAnalyticsAvailable } from '@/shared/utils/analytics';
import mixpanel from 'mixpanel-browser';
import { Rectangle } from 'pixi.js';
import { inlineEditorEvents } from './inlineEditorEvents';

// Minimum amount to scroll viewport when cursor is near the edge.
const MINIMUM_MOVE_VIEWPORT = 50;

class InlineEditorHandler {
  private div?: HTMLDivElement;

  private open = false;
  private showing = false;

  private initialValue = '';

  x = 0;
  y = 0;
  width = 0;
  height = 0;
  location?: SheetPosTS;
  formula: boolean | undefined = undefined;

  cursorIsMoving = false;

  private formatSummary?: CellFormatSummary;
  temporaryBold: boolean | undefined;
  temporaryItalic: boolean | undefined;
  temporaryUnderline: boolean | undefined;
  temporaryStrikeThrough: boolean | undefined;

  constructor() {
    events.on('changeInput', this.changeInput);
    events.on('changeSheet', this.changeSheet);
    events.on('sheetOffsets', this.sheetOffsets);
    events.on('resizeHeadingColumn', this.sheetOffsets);
    events.on('resizeHeadingRow', this.sheetOffsets);
    events.on('resizeRowHeights', this.sheetOffsets);
    inlineEditorEvents.on('replaceText', this.replaceText);
    createFormulaStyleHighlights();
  }

  private sheetOffsets = (sheetId: string) => {
    if (this.location?.sheetId === sheetId) {
      if (this.open) {
        this.updateMonacoCellLayout();
      }
    }
  };

  // Resets state after editing is complete.
  private reset() {
    this.open = false;
    this.initialValue = '';
    inlineEditorMonaco.set('');
    inlineEditorEvents.emit('status', false);
    this.cursorIsMoving = false;
    this.x = this.y = this.width = this.height = 0;
    this.location = undefined;
    this.formula = undefined;
    this.formatSummary = undefined;
    this.temporaryBold = undefined;
    this.temporaryItalic = undefined;
    this.temporaryUnderline = undefined;
    this.temporaryStrikeThrough = undefined;
    this.changeToFormula(false);
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
      }
      inlineEditorFormula.cursorMoved();
    } else {
      this.close(0, 0, true);
    }
  };

  // Handler for the changeInput event.
  private changeInput = async (input: boolean, initialValue?: string) => {
    if (!input && !this.open) return;

    if (initialValue) {
      this.initialValue += initialValue;
      initialValue = this.initialValue;
    } else {
      this.initialValue = '';
    }

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
      this.formatSummary = await quadraticCore.getCellFormatSummary(
        this.location.sheetId,
        this.location.x,
        this.location.y,
        true
      );
      this.temporaryBold = this.formatSummary?.bold || undefined;
      this.temporaryItalic = this.formatSummary?.italic || undefined;
      this.temporaryUnderline = this.formatSummary?.underline || undefined;
      this.temporaryStrikeThrough = this.formatSummary?.strikeThrough || undefined;
      inlineEditorMonaco.set(value);
      inlineEditorMonaco.setBackgroundColor(
        this.formatSummary.fillColor ? convertColorStringToHex(this.formatSummary.fillColor) : '#ffffff'
      );
      this.updateFont();
      pixiApp.cellsSheets.updateCellsArray();
      this.sendMultiplayerUpdate();
      this.showDiv();
      this.changeToFormula(changeToFormula);
      this.updateMonacoCursorPosition();
      inlineEditorEvents.emit('status', true, value);
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
      underline: this.temporaryUnderline,
      strikeThrough: this.temporaryStrikeThrough,
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

  toggleUnderline() {
    if (this.temporaryUnderline === undefined) {
      this.temporaryUnderline = !this.formatSummary?.underline;
    } else {
      this.temporaryUnderline = !this.temporaryUnderline;
    }
    inlineEditorMonaco.setUnderline(this.temporaryUnderline);
    this.sendMultiplayerUpdate();
  }

  toggleStrikeThrough() {
    if (this.temporaryStrikeThrough === undefined) {
      this.temporaryStrikeThrough = !this.formatSummary?.strikeThrough;
    } else {
      this.temporaryStrikeThrough = !this.temporaryStrikeThrough;
    }
    inlineEditorMonaco.setStrikeThrough(this.temporaryStrikeThrough);
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
    if (!this.location) return;

    const value = inlineEditorMonaco.get();
    if (value[0] === '=') {
      this.changeToFormula(true);
    } else if (this.formula && value[0] !== '=') {
      this.changeToFormula(false);
    }

    this.updateMonacoCellLayout();

    if (this.formula) {
      inlineEditorFormula.cellHighlights(this.location, value.slice(1));
    }
    this.sendMultiplayerUpdate();
  };

  updateMonacoCellLayout = () => {
    if (!this.location) return;

    const { x, y, width, height } = sheets.sheet.getCellOffsets(this.location.x, this.location.y);
    const cellOutlineOffset = CURSOR_THICKNESS * (this.formula ? 0.5 : 1);
    const cellContentWidth = width - cellOutlineOffset * 2;
    const cellContentHeight = height - cellOutlineOffset * 2;
    const align = this.formatSummary?.align ?? 'left';
    const verticalAlign = this.formatSummary?.verticalAlign ?? 'top';
    const wrap = this.formatSummary?.wrap ?? 'overflow';
    const underline = this.formatSummary?.underline ?? false;
    const strikeThrough = this.formatSummary?.strikeThrough ?? false;
    const { width: inlineEditorWidth, height: inlineEditorHeight } = inlineEditorMonaco.updateTextLayout(
      cellContentWidth,
      cellContentHeight,
      align,
      verticalAlign,
      wrap,
      underline,
      strikeThrough
    );

    this.x = cellOutlineOffset + (align === 'right' ? Math.min(x, x + cellContentWidth - inlineEditorWidth) : x);
    this.y =
      cellOutlineOffset + (verticalAlign === 'bottom' ? Math.min(y, y + cellContentHeight - inlineEditorHeight) : y);
    this.width = inlineEditorWidth;
    this.height = inlineEditorHeight + OPEN_SANS_FIX.y / 3;

    if (!pixiAppSettings.setInlineEditorState) {
      throw new Error('Expected pixiAppSettings.setInlineEditorState to be defined in InlineEditorHandler');
    }
    pixiAppSettings.setInlineEditorState((prev) => ({
      ...prev,
      left: this.x,
      top: this.y + OPEN_SANS_FIX.y / 3,
      lineHeight: this.height,
    }));

    pixiApp.cursor.dirty = true;
  };

  // Toggle between normal editor and formula editor.
  private changeToFormula = (formula: boolean) => {
    if (this.formula === formula) return;
    if (!pixiAppSettings.setInlineEditorState) {
      throw new Error('Expected pixiAppSettings.setInlineEditorState to be defined in InlineEditorHandler');
    }
    this.formula = formula;
    if (formula) {
      inlineEditorMonaco.setLanguage('Formula');

      // need to show the change to A1 notation
      pixiApp.headings.dirty = true;
    } else {
      inlineEditorMonaco.setLanguage('plaintext');
    }

    pixiAppSettings.setInlineEditorState((prev) => ({
      ...prev,
      formula,
    }));

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

  validateInput = async (): Promise<string | undefined> => {
    if (!this.open || !this.location || this.formula) return;
    const value = inlineEditorMonaco.get();
    const validationError = await quadraticCore.validateInput(
      this.location.sheetId,
      this.location.x,
      this.location.y,
      value
    );
    return validationError;
  };

  // Close editor. It saves the value if cancel = false. It also moves the
  // cursor by (deltaX, deltaY).
  // @returns whether the editor closed successfully
  close = async (deltaX = 0, deltaY = 0, cancel: boolean): Promise<boolean> => {
    if (!this.open) return true;
    if (!this.location) {
      throw new Error('Expected location to be defined in InlineEditorHandler');
    }
    let value = inlineEditorMonaco.get();

    if (this.cursorIsMoving) {
      inlineEditorKeyboard.resetKeyboardPosition(true);
    }

    if (!cancel) {
      // Ensure we're on the right sheet so we can show the change
      sheets.current = this.location.sheetId;

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
        const location = { ...this.location };
        const validationError = await this.validateInput();
        if (validationError) {
          events.emit('hoverCell', { x: this.location.x, y: this.location.y, validationId: validationError, value });
          return false;
        } else {
          quadraticCore.setCellValue(
            location.sheetId,
            location.x,
            location.y,
            value.trim(),
            sheets.getCursorPosition()
          );
          events.emit('hoverCell');
        }
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
    return true;
  };

  // Handler for the click for the expand code editor button.
  openCodeEditor = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.stopPropagation();
    if (!pixiAppSettings.setEditorInteractionState) {
      throw new Error('Expected setEditorInteractionState to be defined in openCodeEditor');
    }
    if (!this.location) {
      throw new Error('Expected location to be defined in openCodeEditor');
    }
    pixiAppSettings.setEditorInteractionState({
      ...pixiAppSettings.editorInteractionState,
      waitingForEditorClose: {
        selectedCellSheet: this.location.sheetId,
        selectedCell: { x: this.location.x, y: this.location.y },
        mode: 'Formula',
        showCellTypeMenu: false,
        initialCode: inlineEditorMonaco.get().slice(1),
      },
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

    this.close(0, 0, true);
  }

  detach() {
    this.div = undefined;
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

  private showDiv = () => {
    if (!this.div) {
      throw new Error('Expected div to be defined in showDiv');
    }
    if (!pixiAppSettings.setInlineEditorState) {
      throw new Error('Expected pixiAppSettings.setInlineEditorState to be defined in InlineEditorHandler');
    }

    pixiAppSettings.setInlineEditorState((prev) => ({
      ...prev,
      visible: true,
    }));
    this.showing = true;
  };

  private hideDiv = () => {
    if (!this.div) {
      throw new Error('Expected div to be defined in showDiv');
    }
    if (!pixiAppSettings.setInlineEditorState) {
      throw new Error('Expected pixiAppSettings.setInlineEditorState to be defined in InlineEditorHandler');
    }

    pixiAppSettings.setInlineEditorState((prev) => ({
      ...prev,
      visible: false,
    }));
    this.showing = false;
  };

  // Called when manually changing cell position via clicking on a new cell
  // (except when editing formula). Returns whether the editor can be closed
  // (ie, if it fails validation with a ValidationStyle::Stop, we do not let it
  // close)
  async handleCellPointerDown(): Promise<boolean> {
    if (this.open) {
      if (!this.formula || !inlineEditorFormula.wantsCellRef()) {
        return await this.close(0, 0, false);
      } else {
        if (!this.cursorIsMoving) {
          this.cursorIsMoving = true;
          inlineEditorFormula.addInsertingCells(inlineEditorMonaco.getCursorColumn());
        }
      }
    }
    return true;
  }

  private replaceText = (text: string, highlight: boolean) => {
    if (!this.open) return;
    inlineEditorMonaco.set(text, highlight);
  };
}

export const inlineEditorHandler = new InlineEditorHandler();
