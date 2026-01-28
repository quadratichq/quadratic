//! This replaces CellInput.tsx as the inline cell editor for the grid. It uses
//! Monaco Editor to enable proper Formula editor with syntax highlighting and
//! completion.

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorEvents } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorEvents';
import { inlineEditorFormula } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorFormula';
import { CursorMode, inlineEditorKeyboard } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorKeyboard';
import { inlineEditorMonaco, PADDING_FOR_INLINE_EDITOR } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorMonaco';
import { inlineEditorSpans, type SpanFormatting } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorSpans';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { CURSOR_THICKNESS } from '@/app/gridGL/UI/Cursor';
import { convertColorStringToHex } from '@/app/helpers/convertColor';
import { focusGrid } from '@/app/helpers/focusGrid';
import type { CellFormatSummary, JsRenderCodeCell, TextSpan } from '@/app/quadratic-core-types';
import type { SheetPosTS } from '@/app/shared/types/size';
import { createFormulaStyleHighlights } from '@/app/ui/menus/CodeEditor/hooks/useEditorCellHighlights';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { LINE_HEIGHT, OPEN_SANS_FIX } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellLabel';
import { CELL_HEIGHT, DEFAULT_FONT_SIZE } from '@/shared/constants/gridConstants';
import { googleAnalyticsAvailable } from '@/shared/utils/analytics';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import BigNumber from 'bignumber.js';
import { Rectangle } from 'pixi.js';

class InlineEditorHandler {
  private div?: HTMLDivElement;

  private open = false;
  private showing = false;

  private initialValue = '';

  x = 0;
  y = 0;
  width = 0;
  height = 0;
  // The cell being edited (anchor for merged cells). Use this for all data operations
  // (reading/writing cell values, formula operations, validation, etc.)
  location?: SheetPosTS;
  // The original cursor position where the user clicked. Use this for UI positioning
  // (editor placement, popup positioning, etc.). For merged cells, this may differ from location.
  cursorLocation?: SheetPosTS;
  formula: boolean | undefined = undefined;

  cursorIsMoving = false;

  private formatSummary?: CellFormatSummary;
  temporaryBold: boolean | undefined;
  temporaryItalic: boolean | undefined;
  temporaryUnderline: boolean | undefined;
  temporaryStrikeThrough: boolean | undefined;

  private codeCell?: JsRenderCodeCell;

  constructor() {
    events.on('changeInput', this.changeInput);
    events.on('changeSheet', this.changeSheet);
    events.on('sheetOffsetsUpdated', this.sheetOffsets);
    events.on('resizeHeadingColumn', this.sheetOffsets);
    events.on('resizeHeadingRow', this.sheetOffsets);
    events.on('contextMenu', this.closeIfOpen);
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
    inlineEditorEvents.emit('selectionFormatting', undefined);
    this.cursorIsMoving = false;
    this.x = this.y = this.width = this.height = 0;
    this.location = undefined;
    this.cursorLocation = undefined;
    this.formula = undefined;
    this.formatSummary = undefined;
    this.temporaryBold = undefined;
    this.temporaryItalic = undefined;
    this.temporaryUnderline = undefined;
    this.temporaryStrikeThrough = undefined;
    this.codeCell = undefined;
    this.changeToFormula(false);
    inlineEditorKeyboard.resetKeyboardPosition();
    inlineEditorFormula.clearDecorations();
    inlineEditorSpans.clear();
    window.removeEventListener('keydown', inlineEditorKeyboard.keyDown);
    multiplayer.sendEndCellEdit();
    this.hideDiv();
  }

  // Keeps the cursor visible in the viewport.
  keepCursorVisible = () => {
    if (sheets.current !== this.location?.sheetId || !this.showing) return;

    const sheetRectangle = pixiApp.getViewportRectangle();
    const scale = pixiApp.viewport.scale.x;
    const canvas = pixiApp.canvas.getBoundingClientRect();

    // calculate inline editor rectangle, factoring in scale
    const { bounds, position } = inlineEditorMonaco.getEditorSizing();
    const editorWidth = this.width * scale;
    const editorTopLeft = pixiApp.viewport.toWorld(bounds.left - canvas.left, bounds.top - canvas.top);
    const editorBottomRight = pixiApp.viewport.toWorld(
      bounds.left + editorWidth - canvas.left,
      bounds.bottom - canvas.top
    );
    const editorRectangle = new Rectangle(
      editorTopLeft.x,
      editorTopLeft.y,
      editorBottomRight.x - editorTopLeft.x,
      editorBottomRight.y - editorTopLeft.y
    );

    let x = 0;
    if (editorRectangle.left - PADDING_FOR_INLINE_EDITOR <= sheetRectangle.left) {
      x = sheetRectangle.left + -(editorRectangle.left - PADDING_FOR_INLINE_EDITOR);
    } else if (editorRectangle.right + PADDING_FOR_INLINE_EDITOR >= sheetRectangle.right) {
      x = sheetRectangle.right - (editorRectangle.right + PADDING_FOR_INLINE_EDITOR);
    }

    let y = 0;
    // check if the editor is too tall to fit in the viewport
    if (editorRectangle.height + PADDING_FOR_INLINE_EDITOR <= sheetRectangle.height) {
      // keep the editor in view
      if (editorRectangle.top - PADDING_FOR_INLINE_EDITOR <= sheetRectangle.top) {
        y = sheetRectangle.top - (editorRectangle.top - PADDING_FOR_INLINE_EDITOR);
      } else if (editorRectangle.bottom + PADDING_FOR_INLINE_EDITOR >= sheetRectangle.bottom) {
        y = sheetRectangle.bottom - (editorRectangle.bottom + PADDING_FOR_INLINE_EDITOR);
      }
    } else {
      // just keep the cursor in view
      const cursorTop = pixiApp.viewport.toWorld(
        position.left * scale + bounds.left - canvas.left,
        position.top * scale + bounds.top - canvas.top
      );
      const cursorBottom = pixiApp.viewport.toWorld(
        position.left * scale + bounds.left - canvas.left,
        position.top * scale + position.height * scale + bounds.top - canvas.top
      );
      if (cursorTop.y < sheetRectangle.top) {
        y = sheetRectangle.top - cursorTop.y;
      } else if (cursorBottom.y > sheetRectangle.bottom) {
        y = sheetRectangle.bottom - cursorBottom.y;
      }
    }

    if (x || y) {
      const { width, height } = content.headings.headingSize;
      pixiApp.viewport.x = Math.min(pixiApp.viewport.x + x * scale, width);
      pixiApp.viewport.y = Math.min(pixiApp.viewport.y + y * scale, height);
      pixiApp.setViewportDirty();
    }
  };

  private changeSheet = () => {
    if (!this.div || !this.location || !this.open) return;
    if (this.formula) {
      if (sheets.current !== this.location.sheetId) {
        this.hideDiv();
        // not sure why this is here
        window.removeEventListener('keydown', inlineEditorKeyboard.keyDown);
        window.addEventListener('keydown', inlineEditorKeyboard.keyDown);
      } else {
        this.showDiv();
        window.removeEventListener('keydown', inlineEditorKeyboard.keyDown);
        this.updateMonacoCursorPosition();
      }
    } else {
      this.close({ skipChangeSheet: true });
    }
  };

  // Handler for the changeInput event.
  private changeInput = async (input: boolean, initialValue?: string, cursorMode?: CursorMode) => {
    if (!input && !this.open) {
      return;
    }
    if (initialValue) {
      this.initialValue += initialValue;
      initialValue = this.initialValue;
    } else {
      this.initialValue = '';
    }

    if (!this.div) {
      return;
    }

    if (input) {
      const sheet = sheets.sheet;
      const cursor = sheet.cursor.position;

      // For merged cells, we need to edit the anchor cell (where the value lives)
      // but we'll use the cursor position for positioning the editor
      const mergeRect = sheet.getMergeCellRect(cursor.x, cursor.y);
      const editLocation = mergeRect
        ? { x: Number(mergeRect.min.x), y: Number(mergeRect.min.y) }
        : { x: cursor.x, y: cursor.y };

      // Store both the edit location (anchor) and cursor location (for positioning)
      this.location = {
        sheetId: sheet.id,
        x: editLocation.x,
        y: editLocation.y,
      };

      this.cursorLocation = {
        sheetId: sheet.id,
        x: cursor.x,
        y: cursor.y,
      };

      this.formatSummary = await quadraticCore.getCellFormatSummary(
        this.location.sheetId,
        this.location.x,
        this.location.y
      );

      let value: string;
      let changeToFormula = false;
      let richTextSpans: TextSpan[] | null = null;
      if (initialValue) {
        changeToFormula = initialValue[0] === '=';

        value = initialValue;
      } else {
        const formula = await quadraticCore.getCodeCell(this.location.sheetId, this.location.x, this.location.y);

        if (formula?.language === 'Formula') {
          changeToFormula = true;

          value = '=' + formula.code_string;
        } else {
          changeToFormula = false;

          const jsCellValue = await quadraticCore.getCellValue(this.location.sheetId, this.location.x, this.location.y);
          if (jsCellValue) {
            if (jsCellValue.kind === 'Number') {
              this.formatSummary.align = this.formatSummary.align ?? 'right';
            }
            value = jsCellValue.kind === 'Number' ? new BigNumber(jsCellValue.value).toString() : jsCellValue.value;
            if (this.formatSummary?.numericFormat?.type === 'PERCENTAGE') {
              try {
                const number = new BigNumber(value).multipliedBy(100).toString();
                value = number + '%';
              } catch (e) {}
            }

            // Store RichText spans to initialize hyperlink tracking after Monaco is ready
            if (jsCellValue.kind === 'RichText' && jsCellValue.spans) {
              richTextSpans = jsCellValue.spans;
            }

            // open the calendar pick if the cell is a date
            if (['Date', 'DateTime'].includes(jsCellValue.kind)) {
              pixiAppSettings.setEditorInteractionState?.({
                ...pixiAppSettings.editorInteractionState,
                annotationState: `calendar${jsCellValue.kind === 'DateTime' ? '-time' : ''}`,
              });
            }
          } else {
            value = '';
          }
        }
      }

      this.codeCell = content.cellsSheet.tables.getCodeCellIntersects(this.location);
      if (this.codeCell?.language === 'Import' && changeToFormula) {
        pixiAppSettings.snackbar('Cannot create formula inside table', { severity: 'error' });
        this.closeIfOpen();
        return;
      }

      if (cursorMode === undefined) {
        if (changeToFormula) {
          cursorMode = value.length > 1 ? CursorMode.Edit : CursorMode.Enter;
        } else {
          cursorMode = value ? CursorMode.Edit : CursorMode.Enter;
        }
      }

      pixiAppSettings.setInlineEditorState?.((prev) => ({
        ...prev,
        editMode: cursorMode === CursorMode.Edit,
      }));

      this.temporaryBold = this.formatSummary?.bold || undefined;
      this.temporaryItalic = this.formatSummary?.italic || undefined;
      this.temporaryUnderline = this.formatSummary?.underline || undefined;
      this.temporaryStrikeThrough = this.formatSummary?.strikeThrough || undefined;
      inlineEditorMonaco.set(value);

      // Initialize hyperlink tracking after Monaco has the content
      if (richTextSpans) {
        inlineEditorSpans.setSpans(richTextSpans);
      }

      inlineEditorMonaco.triggerSuggestion();
      inlineEditorMonaco.setBackgroundColor(
        this.formatSummary.fillColor ? convertColorStringToHex(this.formatSummary.fillColor) : '#ffffff'
      );
      inlineEditorMonaco.setTextColor(
        this.formatSummary.textColor ? convertColorStringToHex(this.formatSummary.textColor) : undefined
      );
      this.updateFont();
      this.sendMultiplayerUpdate();
      this.showDiv();
      this.changeToFormula(changeToFormula);
      this.updateMonacoCursorPosition();

      inlineEditorEvents.emit('status', true, value);

      // Manually trigger valueChanged if the initial value ends with : to show emoji dropdown
      // Only trigger if : is at the start or after whitespace (not after text like "test:")
      if (value.endsWith(':') && !this.formula) {
        const beforeColon = value.slice(0, -1);
        if (beforeColon === '' || beforeColon.match(/\s$/)) {
          // Small delay to ensure the editor is fully initialized
          setTimeout(() => {
            inlineEditorEvents.emit('valueChanged', value);
          }, 10);
        }
      }

      // this needs to be at the end to avoid a race condition where the cursor
      // draws at 0,0 when editing in a data table
      this.open = true;

      // Emit initial formatting state so toolbar reflects the current state
      this.updateSelectionFormatting();
    } else {
      this.close({});
    }
  };

  // Sends CellEdit updates to the multiplayer server.
  sendMultiplayerUpdate = () => {
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
  };

  toggleItalics = () => {
    if (this.temporaryItalic === undefined) {
      this.temporaryItalic = !this.formatSummary?.italic;
    } else {
      this.temporaryItalic = !this.temporaryItalic;
    }
    this.updateFont();
    this.sendMultiplayerUpdate();
  };

  toggleBold = () => {
    if (this.temporaryBold === undefined) {
      this.temporaryBold = !this.formatSummary?.bold;
    } else {
      this.temporaryBold = !this.temporaryBold;
    }
    this.updateFont();
    this.sendMultiplayerUpdate();
  };

  toggleUnderline = () => {
    if (this.temporaryUnderline === undefined) {
      this.temporaryUnderline = !this.formatSummary?.underline;
    } else {
      this.temporaryUnderline = !this.temporaryUnderline;
    }
    inlineEditorMonaco.setUnderline(this.temporaryUnderline);
    this.sendMultiplayerUpdate();
  };

  toggleStrikeThrough = () => {
    if (this.temporaryStrikeThrough === undefined) {
      this.temporaryStrikeThrough = !this.formatSummary?.strikeThrough;
    } else {
      this.temporaryStrikeThrough = !this.temporaryStrikeThrough;
    }
    inlineEditorMonaco.setStrikeThrough(this.temporaryStrikeThrough);
    this.sendMultiplayerUpdate();
  };

  /**
   * Check if the inline editor is open, not editing a formula, and has a text selection.
   */
  hasTextSelection(): boolean {
    return this.open && !this.formula && inlineEditorMonaco.hasSelection();
  }

  /**
   * Check if the inline editor is open and not editing a formula.
   */
  isOpenForText(): boolean {
    return this.open && !this.formula;
  }

  /**
   * Emit the selection formatting event based on the current selection or cursor position.
   * Called when the selection changes in the Monaco editor or when temporary formatting changes.
   */
  updateSelectionFormatting = () => {
    if (!this.open || this.formula) {
      inlineEditorEvents.emit('selectionFormatting', undefined);
      return;
    }

    if (inlineEditorMonaco.hasSelection()) {
      // If there's a selection, get the formatting from the spans
      const formatting = inlineEditorSpans.getSelectionFormattingSummary();
      inlineEditorEvents.emit('selectionFormatting', formatting);
    } else {
      // If no selection, check formatting at the cursor position first
      const cursorFormatting = inlineEditorSpans.getFormattingAtCursor();
      if (cursorFormatting) {
        // Use the span formatting at cursor position
        inlineEditorEvents.emit('selectionFormatting', cursorFormatting);
      } else {
        // Fall back to temporary formatting state (for when typing new text)
        const formatting = {
          bold: this.temporaryBold ?? this.formatSummary?.bold ?? false,
          italic: this.temporaryItalic ?? this.formatSummary?.italic ?? false,
          underline: this.temporaryUnderline ?? this.formatSummary?.underline ?? false,
          strikeThrough: this.temporaryStrikeThrough ?? this.formatSummary?.strikeThrough ?? false,
          textColor: this.formatSummary?.textColor ?? undefined,
        };
        inlineEditorEvents.emit('selectionFormatting', formatting);
      }
    }
  };

  /**
   * Get the current displayed state for a formatting property.
   * This checks span formatting at cursor first, then falls back to temporary formatting.
   */
  private getCurrentFormattingState(property: 'bold' | 'italic' | 'underline' | 'strikeThrough'): boolean {
    const cursorFormatting = inlineEditorSpans.getFormattingAtCursor();
    if (cursorFormatting) {
      return cursorFormatting[property] ?? false;
    }
    // Fall back to temporary formatting
    switch (property) {
      case 'bold':
        return this.temporaryBold ?? this.formatSummary?.bold ?? false;
      case 'italic':
        return this.temporaryItalic ?? this.formatSummary?.italic ?? false;
      case 'underline':
        return this.temporaryUnderline ?? this.formatSummary?.underline ?? false;
      case 'strikeThrough':
        return this.temporaryStrikeThrough ?? this.formatSummary?.strikeThrough ?? false;
    }
  }

  /**
   * Get the current text color state at the cursor position.
   * This checks span formatting at cursor first, then falls back to cell-level formatting.
   */
  private getCurrentTextColor(): string | undefined {
    const cursorFormatting = inlineEditorSpans.getFormattingAtCursor();
    if (cursorFormatting) {
      return cursorFormatting.textColor;
    }
    // Fall back to cell-level formatting
    return this.formatSummary?.textColor ?? undefined;
  }

  /**
   * Get the current formatting state for all properties at the cursor position.
   * Used when creating empty spans to preserve existing formatting.
   */
  private getCurrentFormattingStateAll(): SpanFormatting {
    return {
      bold: this.getCurrentFormattingState('bold'),
      italic: this.getCurrentFormattingState('italic'),
      underline: this.getCurrentFormattingState('underline'),
      strikeThrough: this.getCurrentFormattingState('strikeThrough'),
      textColor: this.getCurrentTextColor(),
    };
  }

  /**
   * Get the current formatting state for all properties at the cursor position.
   * Public version for use when creating hyperlinks that should inherit formatting.
   */
  getFormattingStateForHyperlink(): SpanFormatting {
    return this.getCurrentFormattingStateAll();
  }

  /**
   * Toggle bold formatting for the current selection or create empty span.
   * Returns true if formatting was handled by the inline editor, false otherwise.
   */
  toggleBoldForSelection = (): boolean => {
    if (!this.isOpenForText()) {
      return false;
    }
    // If there's a selection, apply span formatting
    if (inlineEditorMonaco.hasSelection()) {
      // Pass cell-level bold so toggle knows the "visual" state when no span exists
      inlineEditorSpans.toggleFormattingForSelection('bold', this.formatSummary?.bold ?? undefined);
      this.updateFont(); // Switch to CSS-based bold/italic when spans are active
      this.updateSelectionFormatting();
      return true;
    }
    // No selection - create an empty span at cursor with toggled formatting
    // Preserve all other formatting properties from the current position
    const currentFormatting = this.getCurrentFormattingStateAll();
    inlineEditorSpans.createEmptySpanAtCursor({
      ...currentFormatting,
      bold: !currentFormatting.bold,
    });
    this.updateFont(); // Switch to CSS-based bold/italic when spans are active
    this.updateSelectionFormatting();
    return true;
  };

  /**
   * Toggle italic formatting for the current selection or create empty span.
   * Returns true if formatting was handled by the inline editor, false otherwise.
   */
  toggleItalicForSelection = (): boolean => {
    if (!this.isOpenForText()) {
      return false;
    }
    // If there's a selection, apply span formatting
    if (inlineEditorMonaco.hasSelection()) {
      // Pass cell-level italic so toggle knows the "visual" state when no span exists
      inlineEditorSpans.toggleFormattingForSelection('italic', this.formatSummary?.italic ?? undefined);
      this.updateFont(); // Switch to CSS-based bold/italic when spans are active
      this.updateSelectionFormatting();
      return true;
    }
    // No selection - create an empty span at cursor with toggled formatting
    const currentFormatting = this.getCurrentFormattingStateAll();
    inlineEditorSpans.createEmptySpanAtCursor({
      ...currentFormatting,
      italic: !currentFormatting.italic,
    });
    this.updateFont(); // Switch to CSS-based bold/italic when spans are active
    this.updateSelectionFormatting();
    return true;
  };

  /**
   * Toggle underline formatting for the current selection or create empty span.
   * Returns true if formatting was handled by the inline editor, false otherwise.
   */
  toggleUnderlineForSelection = (): boolean => {
    if (!this.isOpenForText()) {
      return false;
    }
    // If there's a selection, apply span formatting
    if (inlineEditorMonaco.hasSelection()) {
      // Pass cell-level underline so toggle knows the "visual" state when no span exists
      inlineEditorSpans.toggleFormattingForSelection('underline', this.formatSummary?.underline ?? undefined);
      this.updateSelectionFormatting();
      return true;
    }
    // No selection - create an empty span at cursor with toggled formatting
    const currentFormatting = this.getCurrentFormattingStateAll();
    inlineEditorSpans.createEmptySpanAtCursor({
      ...currentFormatting,
      underline: !currentFormatting.underline,
    });
    this.updateSelectionFormatting();
    return true;
  };

  /**
   * Toggle strikethrough formatting for the current selection or create empty span.
   * Returns true if formatting was handled by the inline editor, false otherwise.
   */
  toggleStrikeThroughForSelection = (): boolean => {
    if (!this.isOpenForText()) {
      return false;
    }
    // If there's a selection, apply span formatting
    if (inlineEditorMonaco.hasSelection()) {
      // Pass cell-level strikeThrough so toggle knows the "visual" state when no span exists
      inlineEditorSpans.toggleFormattingForSelection('strikeThrough', this.formatSummary?.strikeThrough ?? undefined);
      this.updateSelectionFormatting();
      return true;
    }
    // No selection - create an empty span at cursor with toggled formatting
    const currentFormatting = this.getCurrentFormattingStateAll();
    inlineEditorSpans.createEmptySpanAtCursor({
      ...currentFormatting,
      strikeThrough: !currentFormatting.strikeThrough,
    });
    this.updateSelectionFormatting();
    return true;
  };

  /**
   * Set text color for the current selection or create empty span.
   * Returns true if formatting was handled by the inline editor, false otherwise.
   */
  setTextColorForSelection = (color: string | undefined): boolean => {
    if (!this.isOpenForText()) {
      return false;
    }
    // If there's a selection, apply span formatting
    if (inlineEditorMonaco.hasSelection()) {
      inlineEditorSpans.applyFormattingToSelection({ textColor: color });
      this.updateSelectionFormatting();
      return true;
    }
    // No selection - create an empty span at cursor with the new text color
    // Preserve all other formatting properties from the current position
    const currentFormatting = this.getCurrentFormattingStateAll();
    inlineEditorSpans.createEmptySpanAtCursor({
      ...currentFormatting,
      textColor: color,
    });
    this.updateSelectionFormatting();
    return true;
  };

  /**
   * Clear span formatting when the inline editor is open (not editing a formula).
   * If there's a selection, clears formatting only for the selected text.
   * If no selection but cursor is in a span, clears that span's formatting.
   * Does not clear cell-level formatting - only span-level formatting.
   * Returns true if formatting was cleared, false otherwise.
   */
  clearSpanFormatting = (): boolean => {
    if (!this.open || this.formula) {
      return false;
    }
    // If there's a selection, clear formatting only for the selection
    if (inlineEditorMonaco.hasSelection()) {
      inlineEditorSpans.clearFormattingForSelection();
      this.updateFont(); // May switch back to font-family-based bold/italic if spans are cleared
      this.updateSelectionFormatting();
      return true;
    }
    // If no selection, try to clear the span at the cursor position
    if (inlineEditorSpans.clearFormattingAtCursor()) {
      this.updateFont(); // May switch back to font-family-based bold/italic if spans are cleared
      this.updateSelectionFormatting();
      return true;
    }
    // No span at cursor - don't clear cell-level formatting
    return false;
  };

  private updateFont = () => {
    if (!this.formula) {
      const italic = this.temporaryItalic === undefined ? this.formatSummary?.italic : this.temporaryItalic;
      const bold = this.temporaryBold === undefined ? this.formatSummary?.bold : this.temporaryBold;

      // When there are active spans (RichText), use base font and CSS for bold/italic
      // so span-level formatting can override cell-level formatting.
      // When there are no spans (plain text with cell-level formatting), set the font family
      // directly so Monaco can use correct font metrics for cursor positioning.
      if (inlineEditorSpans.isActive()) {
        inlineEditorMonaco.setFontFamily('OpenSans');
        inlineEditorMonaco.setItalic(!!italic);
        inlineEditorMonaco.setBold(!!bold);
      } else {
        // Set font family directly based on bold/italic state for correct cursor positioning
        const fontFamily = this.getFontFamily(!!bold, !!italic);
        inlineEditorMonaco.setFontFamily(fontFamily);
        // Clear CSS data attributes since we're using font family directly
        inlineEditorMonaco.setItalic(false);
        inlineEditorMonaco.setBold(false);
      }
    } else {
      inlineEditorMonaco.setFontFamily('OpenSans');
      inlineEditorMonaco.setItalic(false);
      inlineEditorMonaco.setBold(false);
    }

    // Set font size from format summary
    const fontSize = this.formatSummary?.fontSize ?? DEFAULT_FONT_SIZE;
    inlineEditorMonaco.setFontSize(fontSize);
  };

  /**
   * Get the font family name based on bold and italic formatting.
   */
  private getFontFamily = (bold: boolean, italic: boolean): string => {
    if (bold && italic) {
      return 'OpenSans-BoldItalic';
    } else if (bold) {
      return 'OpenSans-Bold';
    } else if (italic) {
      return 'OpenSans-Italic';
    }
    return 'OpenSans';
  };

  // Refreshes the format summary and updates the font display in the inline editor
  refreshFontSize = async () => {
    if (!this.location) return;

    this.formatSummary = await quadraticCore.getCellFormatSummary(
      this.location.sheetId,
      this.location.x,
      this.location.y
    );

    this.updateFont();
    this.updateMonacoCellLayout();
  };

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

    // Clean up empty spans that the cursor has moved away from
    if (!this.formula) {
      inlineEditorSpans.cleanupEmptySpans();
    }

    // Check if cursor is over a hyperlink and emit event for popup
    this.checkCursorOnHyperlink();

    // Update formatting buttons to reflect the span at the cursor position
    this.updateSelectionFormatting();

    this.sendMultiplayerUpdate();
  };

  // Check if the cursor is over a hyperlink and emit event to show/hide popup
  private checkCursorOnHyperlink = () => {
    // Don't show hyperlink popup when editing formulas
    if (this.formula) {
      events.emit('inlineEditorCursorOnHyperlink', undefined);
      return;
    }

    const editor = inlineEditorMonaco.editor;
    if (!editor || !this.location) return;

    const position = editor.getPosition();
    if (!position) {
      events.emit('inlineEditorCursorOnHyperlink', undefined);
      return;
    }

    const hyperlinkSpan = inlineEditorSpans.getHyperlinkAtPosition(position);
    if (hyperlinkSpan?.link) {
      // Get the cell offsets to position the popup, accounting for merged cells
      const sheet = sheets.sheet;
      // Use cursorLocation for positioning (location is for data storage)
      const cursorLoc = this.cursorLocation ?? this.location;
      const mergeRect = sheet.getMergeCellRect(cursorLoc.x, cursorLoc.y);
      let rect: Rectangle;
      if (mergeRect) {
        rect = sheet.getScreenRectangle(
          Number(mergeRect.min.x),
          Number(mergeRect.min.y),
          Number(mergeRect.max.x) - Number(mergeRect.min.x) + 1,
          Number(mergeRect.max.y) - Number(mergeRect.min.y) + 1
        );
      } else {
        const offsets = sheet.getCellOffsets(cursorLoc.x, cursorLoc.y);
        rect = new Rectangle(offsets.x, offsets.y, offsets.width, offsets.height);
      }
      // Get the link text from the editor content
      const model = editor.getModel();
      const fullText = model?.getValue() ?? '';
      const linkText = fullText.slice(hyperlinkSpan.start, hyperlinkSpan.end);
      events.emit('inlineEditorCursorOnHyperlink', { url: hyperlinkSpan.link, rect, linkText });
    } else {
      events.emit('inlineEditorCursorOnHyperlink', undefined);
    }
  };

  updateMonacoCellLayout = () => {
    if (!this.location || !this.cursorLocation) return;

    // Use the cursor location (where user clicked) for positioning the editor
    // Check if the cursor is part of a merged cell and get the full merged cell rect
    const mergeRect = sheets.sheet.getMergeCellRect(this.cursorLocation.x, this.cursorLocation.y);
    let cellBounds: Rectangle;
    if (mergeRect) {
      cellBounds = sheets.sheet.getScreenRectangle(
        Number(mergeRect.min.x),
        Number(mergeRect.min.y),
        Number(mergeRect.max.x) - Number(mergeRect.min.x) + 1,
        Number(mergeRect.max.y) - Number(mergeRect.min.y) + 1
      );
    } else {
      cellBounds = sheets.sheet.getCellOffsets(this.cursorLocation.x, this.cursorLocation.y);
    }

    const { x, y, width, height } = cellBounds;
    const cellOutlineOffset = CURSOR_THICKNESS * (this.formula ? 0.5 : 1);
    const cellContentWidth = width - cellOutlineOffset * 2;
    const cellContentHeight = height - cellOutlineOffset * 2;
    const align = this.formatSummary?.align ?? 'left';
    let verticalAlign = this.formatSummary?.verticalAlign ?? 'bottom';
    const wrap = this.formatSummary?.wrap ?? (this.codeCell ? 'clip' : 'overflow');
    const underline = this.temporaryUnderline ?? this.formatSummary?.underline ?? false;
    const strikeThrough = this.temporaryStrikeThrough ?? this.formatSummary?.strikeThrough ?? false;

    // For default-sized cells, override vertical alignment to 'middle' to match
    // the centering behavior in CellLabel.ts for rendered text.
    const defaultExtraSpace = CELL_HEIGHT - LINE_HEIGHT;
    if (height - LINE_HEIGHT <= defaultExtraSpace) {
      verticalAlign = 'middle';
    }

    const { width: inlineEditorWidth, height: inlineEditorHeight } = inlineEditorMonaco.updateTextLayout(
      cellContentWidth,
      cellContentHeight,
      align,
      verticalAlign,
      wrap,
      underline,
      strikeThrough,
      this.formula ?? false
    );

    // Calculate x position based on horizontal alignment
    if (align === 'right') {
      this.x = cellOutlineOffset + Math.min(x, x + cellContentWidth - inlineEditorWidth);
    } else if (align === 'center') {
      // Center the editor over the cell (works for both fitting and overflowing content)
      this.x = cellOutlineOffset + x + (cellContentWidth - inlineEditorWidth) / 2;
    } else {
      this.x = cellOutlineOffset + x;
    }
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
      top: this.y,
      height: this.height,
    }));

    events.emit('setDirty', { cursor: true });
  };

  // Toggle between normal editor and formula editor.
  private changeToFormula = (formula: boolean) => {
    if (this.formula === formula) return;
    if (!pixiAppSettings.setInlineEditorState) {
      throw new Error('Expected pixiAppSettings.setInlineEditorState to be defined in InlineEditorHandler');
    }
    if (this.codeCell?.language === 'Import' && formula) {
      pixiAppSettings.snackbar('Cannot create formula inside table', { severity: 'error' });
      this.closeIfOpen();
      return;
    }
    this.formula = formula;
    if (formula) {
      inlineEditorMonaco.setLanguage('Formula');

      // need to show the change to A1 notation
      events.emit('setDirty', { headings: true });
    } else {
      inlineEditorMonaco.setLanguage('inline-editor');
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

  closeIfOpen = async () => {
    if (this.open) {
      await this.close({});
    }
  };

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
  close = async ({
    deltaX = 0,
    deltaY = 0,
    cancel = false,
    skipChangeSheet = false,
    skipFocusGrid = false,
  }: {
    deltaX?: number;
    deltaY?: number;
    cancel?: boolean;
    skipChangeSheet?: boolean;
    skipFocusGrid?: boolean;
  }): Promise<boolean> => {
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
      if (!skipChangeSheet) {
        sheets.current = this.location.sheetId;
      }

      if (this.formula) {
        const updatedValue = inlineEditorFormula.closeParentheses();
        if (updatedValue) value = updatedValue;
        quadraticCore.setCodeCellValue({
          sheetId: this.location.sheetId,
          x: this.location.x,
          y: this.location.y,
          language: 'Formula',
          codeString: value.slice(1),
          isAi: false,
        });
        trackEvent('[CodeEditor].cellRun', {
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
          // need to change the sheet back to the original sheet if there's a validation error
          if (skipChangeSheet) {
            sheets.current = location.sheetId;
          }
          return false;
        } else {
          // Check for URLs at cursor position and auto-convert to hyperlinks
          inlineEditorSpans.checkAutoLinkOnClose();

          const trimmedValue = value.trim();
          // Check if we have formatted spans (e.g., hyperlinks) that require RichText
          if (inlineEditorSpans.isActive() && inlineEditorSpans.hasFormattedSpans()) {
            // Calculate leading whitespace offset to adjust span positions
            const leadingWhitespace = value.length - value.trimStart().length;
            const spans = inlineEditorSpans.buildTextSpans(trimmedValue, leadingWhitespace);
            quadraticCore.setCellRichText(location.sheetId, location.x, location.y, spans);
          } else {
            quadraticCore.setCellValue(location.sheetId, location.x, location.y, trimmedValue, false);
          }
          if (!skipChangeSheet) {
            events.emit('hoverCell');
          }
        }
      }
    }

    this.reset();
    pixiAppSettings.changeInput(false);

    // Update Grid Interaction state, reset input value state
    if (deltaX || deltaY) {
      const position = sheets.sheet.cursor.position;
      sheets.sheet.cursor.moveTo(position.x + deltaX, position.y + deltaY);
    }

    // Set focus back to Grid
    if (!skipFocusGrid) {
      focusGrid();
    }
    return true;
  };

  // Handler for the click for the expand code editor button.
  openCodeEditor = () => {
    if (!pixiAppSettings.setCodeEditorState) {
      throw new Error('Expected setCodeEditorState to be defined in openCodeEditor');
    }
    if (!pixiAppSettings.setCodeEditorState) {
      throw new Error('Expected setEditorInteractionState to be defined in openCodeEditor');
    }
    if (!this.location) {
      throw new Error('Expected location to be defined in openCodeEditor');
    }
    const { sheetId, x, y } = this.location;
    pixiAppSettings.codeEditorState.aiAssistant.abortController?.abort();
    pixiAppSettings.setCodeEditorState({
      ...pixiAppSettings.codeEditorState,
      aiAssistant: {
        abortController: undefined,
        loading: false,
        id: '',
        messages: [],
        waitingOnMessageIndex: undefined,
      },
      diffEditorContent: undefined,
      waitingForEditorClose: {
        codeCell: {
          sheetId,
          pos: { x, y },
          language: 'Formula',
          lastModified: 0,
          isSingleCell: true,
        },
        showCellTypeMenu: false,
        initialCode: inlineEditorMonaco.get().slice(1),
      },
    });
    this.close({ cancel: true });
  };

  // Attaches the inline editor to a div created by React in InlineEditor.tsx
  attach(div: HTMLDivElement) {
    // we only want to call this once
    if (!this.div) {
      inlineEditorMonaco.attach(div);
    }
    this.div = div;

    this.close({ cancel: true });
  }

  detach() {
    this.div = undefined;
  }

  // Returns whether we are editing a formula.
  isEditingFormula() {
    return this.open && this.formula;
  }

  // This checks whether the inline editor is showing (or showing at a given location)
  // Returns the cursor location (not the edit location) for positioning purposes
  getShowing(x?: number, y?: number): SheetPosTS | undefined {
    if (
      this.open &&
      (x === undefined || y === undefined || (this.cursorLocation?.x === x && this.cursorLocation.y === y))
    ) {
      return this.cursorLocation;
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
        return await this.close({});
      } else {
        if (!this.cursorIsMoving) {
          this.cursorIsMoving = true;
          inlineEditorFormula.addInsertingCells(inlineEditorMonaco.getCursorColumn());
        }
      }
    }
    return true;
  }

  private replaceText = (text: string, highlight: boolean | number) => {
    if (!this.open) return;
    inlineEditorMonaco.set(text, highlight);
  };
}

export const inlineEditorHandler = new InlineEditorHandler();
