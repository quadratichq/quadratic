//! Draws the cursor, code cursor, and selection to the screen.

import { hasPermissionToEditFile } from '@/app/actions';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { drawFiniteSelection, drawInfiniteSelection } from '@/app/gridGL/UI/drawCursor';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import type { JsCoordinate, RefRangeBounds } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
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

// todo: DF: this needs to be refactored as many of the table changes were hacks.

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
  }

  // redraws corners if there is an error
  private drawError(cell: JsCoordinate, x: number, y: number, width: number, height: number) {
    const error = pixiApp.cellsSheets.current?.getErrorMarker(cell.x, cell.y);
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
    if (cursor.isSingleSelection() && pixiApp.cellsSheet().tables.isHtmlOrImage(cell)) {
      return;
    }
    const tables = pixiApp.cellsSheet().tables;
    const table = tables.getTableFromCell(cell);
    const tableName = table?.getTableNameBounds();
    const tableColumn = tables.getColumnHeaderCell(cell);
    let { x, y, width, height } = tableName ?? tableColumn ?? sheet.getCellOffsets(cell.x, cell.y);
    const color = pixiApp.accentColor;
    const codeCell = codeEditorState.codeCell;

    pixiApp.hoverTableColumnsSelection.clear();

    // todo: this hides the indicator within tables. When we want to re-enable
    // it so we can autocomplete within tables, then we should change this logic.

    // draw cursor but leave room for cursor indicator if needed
    const indicatorSize =
      hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions) &&
      (!table || table?.isSingleValue()) &&
      !pixiApp.cellsSheet().tables.isColumnHeaderCell(cell) &&
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

    if (table && tableName) {
      // draw cursor
      let g = this.graphics;
      if (table.inOverHeadings) {
        g = pixiApp.hoverTableColumnsSelection;
      }
      g.lineStyle({
        width: 1,
        color: 0xffffff,
        alignment: 0,
      });
      const offset = 1;
      g.moveTo(x + offset, y + offset);
      g.lineTo(x + width - offset, y + offset);
      g.lineTo(x + width - offset, y + height - offset);
      g.moveTo(x + width - offset - 1, y + height - offset);
      g.lineTo(x + offset, y + height - offset);
      g.lineTo(x + offset, y + offset);
    } else {
      let g = this.graphics;
      if (tableColumn) {
        g = pixiApp.hoverTableColumnsSelection;
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
      this.cursorRectangle = undefined;
    } else {
      this.drawError(cell, x, y, width, height);
      this.cursorRectangle = new Rectangle(x, y, width, height);
    }
  }

  // draws the corner icon to resize the table
  private drawTableCornerIndicator() {
    const tableName = sheets.sheet.cursor.getSingleFullTableSelectionName();
    if (!tableName) return;
    const table = pixiApp.cellsSheet().tables.getTableFromName(tableName);
    if (!table) return;

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
      drawFiniteSelection(this.graphics, pixiApp.accentColor, FILL_SELECTION_ALPHA, ranges);
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

      const color = pixiApp.accentColor;
      this.graphics.beginFill(color).drawShape(this.indicator).endFill();
    }
  }

  private drawCodeCursor(): void {
    let color: number | undefined, offsets: { x: number; y: number; width: number; height: number } | undefined;
    const inlineShowing = inlineEditorHandler.getShowing();
    if (inlineEditorHandler.formula && inlineShowing && sheets.current === inlineShowing.sheetId) {
      color = colors.cellColorUserFormula;
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

    let { x, y, width, height } = sheets.sheet.getCellOffsets(inlineShowing.x, inlineShowing.y);
    width = Math.max(inlineEditorHandler.width + CURSOR_THICKNESS * (formula ? 1 : 2), width);
    height = Math.max(inlineEditorHandler.height + CURSOR_THICKNESS * (formula ? 1 : 2), height);
    const color = formula ? colors.cellColorUserFormula : colors.cursorCell;
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
    const foreground = pixiApp.accentColor;
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
    const table = pixiApp.cellsSheet().tables.getTableFromCell(sheets.sheet.cursor.position);
    return table?.codeCell.spill_error;
  }

  // Besides the dirty flag, we also need to update the cursor when the viewport
  // is dirty and columnRow is set because the columnRow selection is drawn to
  // visible bounds on the screen, not to the selection size.
  update(viewportDirty: boolean) {
    const cursor = sheets.sheet.cursor;
    const columnRow = cursor.isColumnRow();
    if (this.dirty || (viewportDirty && columnRow)) {
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
        drawInfiniteSelection({
          g: this.graphics,
          color: pixiApp.accentColor,
          alpha: FILL_SELECTION_ALPHA,
          ranges: infiniteRanges,
        });
        if (
          !columnRow &&
          cursor.rangeCount() === 1 &&
          cursor.getInfiniteRefRangeBounds().length === 0 &&
          !cursor.isOnHtmlImage() &&
          !this.cursorIsOnSpill()
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
}
