//! Draws the cursor, code cursor, and selection to the screen

import { hasPermissionToEditFile } from '@/app/actions';
import { events, type DirtyObject } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { drawFiniteSelection, drawInfiniteSelection } from '@/app/gridGL/UI/drawCursor';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import type { JsCoordinate, RefRangeBounds } from '@/app/quadratic-core-types';
import { Container, Graphics, Rectangle, Sprite } from 'pixi.js';

export const CURSOR_THICKNESS = 2;
export const FILL_SELECTION_ALPHA = 0.1;

const INDICATOR_SIZE = 8;
const INDICATOR_PADDING = 1;
const HIDE_INDICATORS_BELOW_SCALE = 0.1;
const INLINE_NAVIGATE_TEXT_INDICATOR_SIZE = 6;

const CURSOR_CELL_DEFAULT_VALUE = new Rectangle(0, 0, 0, 0);

// outside border when editing the cell
const CURSOR_INPUT_ALPHA = 0.333;

export class Cursor extends Container {
  indicator: Rectangle;
  dirty = true;

  startCell: Rectangle;
  endCell: Rectangle;

  cursorRectangle?: Rectangle;

  graphics: Graphics;

  constructor() {
    super();
    this.graphics = this.addChild(new Graphics());
    this.indicator = new Rectangle();

    this.startCell = CURSOR_CELL_DEFAULT_VALUE;
    this.endCell = CURSOR_CELL_DEFAULT_VALUE;
    this.cursorRectangle = new Rectangle();

    events.on('setDirty', this.setDirty);
    events.on('mergeCells', this.onMergeCellsChanged);

    // Listen for focus/blur events to update cursor color when grid focus changes
    // We listen on the document and check if the active element is the canvas
    document.addEventListener('focusin', this.handleFocusChange);
    document.addEventListener('focusout', this.handleFocusChange);
  }

  destroy() {
    events.off('setDirty', this.setDirty);
    events.off('mergeCells', this.onMergeCellsChanged);
    document.removeEventListener('focusin', this.handleFocusChange);
    document.removeEventListener('focusout', this.handleFocusChange);
    super.destroy();
  }

  private handleFocusChange = () => {
    // Mark as dirty when focus changes (the update will check if canvas is focused)
    this.dirty = true;
  };

  private setDirty = (dirty: DirtyObject) => {
    if (dirty.cursor) {
      this.dirty = true;
    }
  };

  private onMergeCellsChanged = (sheetId: string) => {
    if (sheetId === sheets.current) {
      this.dirty = true;
    }
  };

  // redraws corners if there is an error
  private drawError(cell: JsCoordinate) {
    const error = content.cellsSheets.current?.getErrorMarker(cell.x, cell.y);
    if (error) {
      if (error.triangle) {
        const triangle = this.addChild(new Sprite(error.triangle.texture));
        triangle.position.copyFrom(error.triangle.position);
        triangle.scale.set(error.triangle.scale.x, error.triangle.scale.y);
        triangle.tint = error.triangle.tint;
        triangle.rotation = error.triangle.rotation;
        triangle.anchor.set(error.triangle.anchor.x, error.triangle.anchor.y);
      }
      if (error.symbol) {
        const symbol = this.addChild(new Sprite(error.symbol.texture));
        symbol.position.set(error.symbol.position.x, error.symbol.position.y);
        symbol.width = error.symbol.width;
        symbol.height = error.symbol.height;
        symbol.tint = error.symbol.tint;
        symbol.anchor.set(error.symbol.anchor.x, error.symbol.anchor.y);
      }
    }
  }

  // draws cursor for current user
  private drawCursor() {
    const sheet = sheets.sheet;
    const cursor = sheet.cursor;
    const { viewport } = pixiApp;
    const { codeEditorState } = pixiAppSettings;
    const cell = cursor.position;
    const showInput = pixiAppSettings.input.show;
    if (cursor.isSingleSelection() && content.cellsSheet.tables.isHtmlOrImage(sheets.current, cell)) {
      return;
    }
    const tables = content.cellsSheet.tables;
    let table = tables.getTableIntersects(cell);
    let tableName =
      table && table.codeCell.show_name && table.codeCell.y === cell.y ? table.getTableNameBounds() : undefined;
    if (table && table.codeCell.is_html_image) {
      tableName = table.getTableNameBounds();
    }
    const tableColumn = tables.getColumnHeaderCell(cell);

    // Check if cursor is on a merged cell and get the full merged cell rect
    const mergeRect = sheet.getMergeCellRect(cell.x, cell.y);
    let cellBounds: Rectangle;
    if (tableName) {
      cellBounds = tableName;
    } else if (tableColumn) {
      cellBounds = new Rectangle(tableColumn.x, tableColumn.y, tableColumn.width, tableColumn.height);
    } else if (mergeRect) {
      cellBounds = sheet.getScreenRectangle(
        Number(mergeRect.min.x),
        Number(mergeRect.min.y),
        Number(mergeRect.max.x) - Number(mergeRect.min.x) + 1,
        Number(mergeRect.max.y) - Number(mergeRect.min.y) + 1
      );
    } else {
      cellBounds = sheet.getCellOffsets(cell.x, cell.y);
    }
    let { x, y, width, height } = cellBounds;
    // Use light gray when grid doesn't have focus, otherwise use accent color
    const color = pixiAppSettings.isGridFocused() ? content.accentColor : getCSSVariableTint('muted-foreground');
    const codeCell = codeEditorState.codeCell;

    content.hoverTableColumnsSelection.clear();

    // it so we can autocomplete within tables, then we should change this logic.
    // draw cursor but leave room for cursor indicator if needed
    // Don't show indicator if any cell in selection is in a merged cell
    const hasMergedCellInSelection = sheet.cursor.containsMergedCells();
    const indicatorSize =
      !hasMergedCellInSelection &&
      hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions) &&
      !content.cellsSheet.tables.isInTableHeader(cell) &&
      (!pixiAppSettings.codeEditorState.showCodeEditor ||
        cursor.position.x !== codeCell.pos.x ||
        cursor.position.y !== codeCell.pos.y)
        ? Math.max(INDICATOR_SIZE / viewport.scale.x, INDICATOR_SIZE / 2)
        : 0;

    this.indicator.width = this.indicator.height = indicatorSize;
    const indicatorPadding = Math.max(INDICATOR_PADDING / viewport.scale.x, 1);
    let indicatorOffset = 0;

    const inlineShowing = inlineEditorHandler.getShowing();
    if (showInput) {
      if (inlineShowing) {
        x = inlineEditorHandler.x - CURSOR_THICKNESS;
        y = inlineEditorHandler.y - CURSOR_THICKNESS;
        width = Math.max(inlineEditorHandler.width + CURSOR_THICKNESS * 2, width);
        height = Math.max(inlineEditorHandler.height + CURSOR_THICKNESS * 2, height);
      } else {
        // we have to wait until react renders #cell-edit to properly calculate the width
        setTimeout(() => (this.dirty = true), 0);
      }
    } else {
      if (!cursor.isMultiCursor() && !this.cursorIsOnSpill()) {
        indicatorOffset = indicatorSize / 2 + indicatorPadding;
      }
    }

    if (!tableName) {
      let g = this.graphics;
      if (tableColumn) {
        g = content.hoverTableColumnsSelection;
      }
      g.lineStyle({
        width: CURSOR_THICKNESS,
        color,
        alignment: 0,
      });
      g.moveTo(x, y);
      g.lineTo(x + width, y);
      g.lineTo(x + width, y + height - indicatorOffset);
      g.moveTo(x + width - indicatorOffset, y + height);
      g.lineTo(x, y + height);
      g.lineTo(x, y);
    }

    if (showInput && inlineShowing) {
      this.graphics.lineStyle({
        width: CURSOR_THICKNESS * 1.5,
        color,
        alpha: CURSOR_INPUT_ALPHA,
        alignment: 1,
      });
      this.graphics.drawRect(x, y, width, height);
    } else {
      this.drawError(cell);
    }
  }

  // draws the corner icon to resize the table
  private drawTableCornerIndicator() {
    const tableName = sheets.sheet.cursor.getSingleFullTableSelectionName();
    if (!tableName) return;
    const table = content.cellsSheet.tables.getTableFromName(tableName);
    if (
      !table ||
      table.codeCell.is_html_image ||
      table.codeCell.language !== 'Import' ||
      table.codeCell.state === 'SpillError' ||
      table.codeCell.state === 'RunError'
    )
      return;

    const indicatorSize = Math.max(INDICATOR_SIZE / pixiApp.viewport.scaled, INDICATOR_SIZE);
    this.graphics.lineStyle({
      color: getCSSVariableTint('primary'),
      width: 1,
      alignment: 0,
    });
    this.graphics.beginFill(getCSSVariableTint('background'));
    const b = table.tableBounds;
    this.graphics.drawShape(
      new Rectangle(b.right - indicatorSize / 2, b.bottom - indicatorSize / 2, indicatorSize, indicatorSize)
    );
    this.graphics.endFill();
  }

  private drawFiniteCursor(ranges: RefRangeBounds[]) {
    const sheet = sheets.sheet;
    const { cursor } = sheet;

    this.startCell = sheet.getCellOffsets(cursor.position.x, cursor.position.y);

    if (!sheets.sheet.cursor.isSingleSelection()) {
      // Use light gray when grid doesn't have focus, otherwise use accent color
      const color = pixiAppSettings.isGridFocused() ? content.accentColor : getCSSVariableTint('muted-foreground');
      drawFiniteSelection(this.graphics, color, FILL_SELECTION_ALPHA, ranges);
    }
  }

  private drawCursorIndicator() {
    const { viewport } = pixiApp;
    const cursor = sheets.sheet.cursor;

    if (viewport.scale.x > HIDE_INDICATORS_BELOW_SCALE) {
      const endCell = cursor.bottomRight;
      this.endCell = sheets.sheet.getCellOffsets(endCell.x, endCell.y);

      // draw cursor indicator
      const indicatorSize = Math.max(INDICATOR_SIZE / viewport.scale.x, INDICATOR_SIZE / 2);
      const x = this.endCell.x + this.endCell.width;
      const y = this.endCell.y + this.endCell.height;
      this.indicator.x = x - indicatorSize / 2;
      this.indicator.y = y - indicatorSize / 2;
      this.graphics.lineStyle(0);

      // Use light gray when grid doesn't have focus, otherwise use accent color
      const color = pixiAppSettings.isGridFocused() ? content.accentColor : getCSSVariableTint('muted-foreground');
      this.graphics.beginFill(color).drawShape(this.indicator).endFill();
    }
  }

  private drawCodeCursor(): void {
    let color: number | undefined, offsets: { x: number; y: number; width: number; height: number } | undefined;
    const inlineShowing = inlineEditorHandler.getShowing();
    if (inlineEditorHandler.formula && inlineShowing && sheets.current === inlineShowing.sheetId) {
      color = getCSSVariableTint('primary');
      const { width, height } = sheets.sheet.getCellOffsets(inlineShowing.x, inlineShowing.y);
      offsets = {
        x: inlineEditorHandler.x - CURSOR_THICKNESS * 0.5,
        y: inlineEditorHandler.y - CURSOR_THICKNESS * 0.5,
        width: Math.max(inlineEditorHandler.width + CURSOR_THICKNESS, width),
        height: Math.max(inlineEditorHandler.height + CURSOR_THICKNESS, height),
      };

      this.graphics.lineStyle({
        width: CURSOR_THICKNESS * 1.5,
        color,
        alpha: CURSOR_INPUT_ALPHA,
        alignment: 1,
      });
      this.graphics.drawRect(offsets.x, offsets.y, offsets.width, offsets.height);

      const indicatorHalfSize = INLINE_NAVIGATE_TEXT_INDICATOR_SIZE / 2;
      this.graphics.moveTo(offsets.x + offsets.width + indicatorHalfSize, offsets.y);
      this.graphics.lineTo(offsets.x + offsets.width + indicatorHalfSize + 20, offsets.y);
      this.graphics.lineTo(offsets.x + offsets.width + indicatorHalfSize + 20, offsets.y + offsets.height);
      this.graphics.lineTo(offsets.x + offsets.width + indicatorHalfSize, offsets.y + offsets.height);
    } else {
      return;
    }

    if (!color || !offsets) return;
    this.graphics.lineStyle({
      width: CURSOR_THICKNESS,
      color,
      alignment: 0,
    });
    this.graphics.drawRect(offsets.x, offsets.y, offsets.width, offsets.height);
  }

  private drawInlineCursorModeIndicator() {
    const inlineShowing = inlineEditorHandler.getShowing();
    if (!inlineShowing) return;

    const { visible, editMode, formula } = pixiAppSettings.inlineEditorState;
    if (!visible || !editMode) return;

    let { x, y } = inlineEditorHandler;
    x = inlineEditorHandler.x - CURSOR_THICKNESS;
    y = inlineEditorHandler.y - CURSOR_THICKNESS;

    let { width, height } = sheets.sheet.getCellOffsets(inlineShowing.x, inlineShowing.y);
    width = Math.max(inlineEditorHandler.width + CURSOR_THICKNESS * (formula ? 1 : 2), width);
    height = Math.max(inlineEditorHandler.height + CURSOR_THICKNESS * (formula ? 1 : 2), height);

    const color = formula
      ? getCSSVariableTint('primary')
      : pixiAppSettings.isGridFocused()
        ? content.accentColor
        : getCSSVariableTint('muted-foreground');
    const indicatorSize = INLINE_NAVIGATE_TEXT_INDICATOR_SIZE;
    const halfSize = indicatorSize / 2;
    const corners = [
      { x: x - halfSize + 1, y: y - halfSize + 1 },
      { x: x + width - halfSize - 1, y: y - halfSize + 1 },
      { x: x - halfSize + 1, y: y + height - halfSize - 1 },
      { x: x + width - halfSize - 1, y: y + height - halfSize - 1 },
    ];
    this.graphics.lineStyle(0);
    this.graphics.beginFill(color);
    corners.forEach((corner) => {
      this.graphics.drawRect(corner.x, corner.y, indicatorSize, indicatorSize);
    });
    this.graphics.endFill();
  }

  private drawUnselectDown() {
    const { unselectDown } = pixiApp.pointer.pointerDown;
    if (!unselectDown) return;
    const foreground = content.accentColor;
    this.graphics.lineStyle({ color: foreground, width: 1 });
    const background = getCSSVariableTint('background');
    this.graphics.beginFill(background, 0.5);
    const rectangle = sheets.sheet.getScreenRectangle(
      unselectDown.x,
      unselectDown.y,
      unselectDown.width + 1,
      unselectDown.height + 1
    );
    this.graphics.drawShape(rectangle);
    this.graphics.endFill();
  }

  private cursorIsOnSpill() {
    const pos = sheets.sheet.cursor.position;
    const table = content.cellsSheet.tables.getTable(pos.x, pos.y);
    return table?.codeCell.spill_error;
  }

  private calculateCursorRectangle(
    finiteRanges: RefRangeBounds[],
    infiniteRanges: RefRangeBounds[],
    infiniteRectangle: Rectangle | undefined
  ) {
    const sheet = sheets.sheet;
    if (finiteRanges.length + infiniteRanges.length !== 1) {
      this.cursorRectangle = undefined;
    } else if (finiteRanges.length) {
      this.cursorRectangle = new Rectangle();
      // normalize the coordinates so pointerHeading calculations work correctly
      const xStart = Math.min(Number(finiteRanges[0].start.col.coord), Number(finiteRanges[0].end.col.coord));
      const yStart = Math.min(Number(finiteRanges[0].start.row.coord), Number(finiteRanges[0].end.row.coord));
      const xEnd = Math.max(Number(finiteRanges[0].start.col.coord), Number(finiteRanges[0].end.col.coord));
      const yEnd = Math.max(Number(finiteRanges[0].start.row.coord), Number(finiteRanges[0].end.row.coord));
      const start = sheet.getCellOffsets(xStart, yStart);
      const end = sheet.getCellOffsets(xEnd + 1, yEnd + 1);
      this.cursorRectangle = new Rectangle(start.x, start.y, end.x - start.x, end.y - start.y);
    } else if (infiniteRanges.length) {
      this.cursorRectangle = infiniteRectangle;
    } else {
      this.cursorRectangle = new Rectangle();
    }
  }

  // Besides the dirty flag, we also need to update the cursor when the viewport
  // is dirty and columnRow is set because the columnRow selection is drawn to
  // visible bounds on the screen, not to the selection size.
  update(viewportDirty: boolean) {
    const cursor = sheets.sheet.cursor;
    const columnRow = cursor.isColumnRow();
    if (!this.dirty && !(viewportDirty && columnRow)) {
      return;
    }

    this.dirty = false;
    this.graphics.clear();
    while (this.children.length > 1) {
      this.removeChildAt(1);
    }
    if (!inlineEditorHandler.isEditingFormula()) {
      this.drawCursor();
    }
    this.drawCodeCursor();

    this.drawInlineCursorModeIndicator();

    if (!pixiAppSettings.input.show) {
      const finiteRanges = cursor.getFiniteRefRangeBounds();
      this.drawFiniteCursor(finiteRanges);
      const infiniteRanges = cursor.getInfiniteRefRangeBounds();
      // Use light gray when grid doesn't have focus, otherwise use accent color
      const selectionColor = pixiAppSettings.isGridFocused()
        ? content.accentColor
        : getCSSVariableTint('muted-foreground');
      const infiniteRectangle = drawInfiniteSelection({
        g: this.graphics,
        color: selectionColor,
        alpha: FILL_SELECTION_ALPHA,
        ranges: infiniteRanges,
      });
      this.calculateCursorRectangle(finiteRanges, infiniteRanges, infiniteRectangle);
      if (
        !columnRow &&
        cursor.rangeCount() === 1 &&
        infiniteRanges.length === 0 &&
        !cursor.isOnHtmlImage() &&
        !this.cursorIsOnSpill() &&
        !sheets.sheet.cursor.containsMergedCells()
      ) {
        this.drawCursorIndicator();
      }
    }

    this.drawTableCornerIndicator();

    if (pixiApp.pointer.pointerDown.unselectDown) {
      this.drawUnselectDown();
    }

    pixiApp.setViewportDirty();
  }
}
