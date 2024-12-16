//! Draws the cursor, code cursor, and selection to the screen.

import { hasPermissionToEditFile } from '@/app/actions';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { drawFiniteSelection, drawInfiniteSelection } from '@/app/gridGL/UI/drawCursor';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { CellRefRange, JsCoordinate } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import { Container, Graphics, Rectangle, Sprite } from 'pixi.js';

export const CURSOR_THICKNESS = 2;
export const FILL_ALPHA = 0.1;

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

    let { x, y, width, height } = sheet.getCellOffsets(cell.x, cell.y);
    const color = pixiApp.accentColor;
    const codeCell = codeEditorState.codeCell;

    // draw cursor but leave room for cursor indicator if needed
    const indicatorSize =
      hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions) &&
      (!pixiAppSettings.codeEditorState.showCodeEditor ||
        cursor.position.x !== codeCell.pos.x ||
        cursor.position.y !== codeCell.pos.y)
        ? Math.max(INDICATOR_SIZE / viewport.scale.x, 4)
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
      if (!cursor.isMultiCursor()) {
        indicatorOffset = indicatorSize / 2 + indicatorPadding;
      }
    }

    // hide cursor if code editor is open and CodeCursor is in the same cell
    if (codeEditorState.showCodeEditor && codeCell.pos.x === cell.x && codeCell.pos.y === cell.y) {
      this.cursorRectangle = undefined;
      return;
    }

    // draw cursor
    this.graphics.lineStyle({
      width: CURSOR_THICKNESS,
      color,
      alignment: 0,
    });
    this.graphics.moveTo(x, y);
    this.graphics.lineTo(x + width, y);
    this.graphics.lineTo(x + width, y + height - indicatorOffset);
    this.graphics.moveTo(x + width - indicatorOffset, y + height);
    this.graphics.lineTo(x, y + height);
    this.graphics.lineTo(x, y);

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

  private drawFiniteCursor(ranges: CellRefRange[]) {
    const sheet = sheets.sheet;
    const { cursor } = sheet;

    this.startCell = sheet.getCellOffsets(cursor.position.x, cursor.position.y);
    drawFiniteSelection(this.graphics, pixiApp.accentColor, FILL_ALPHA, ranges);
  }

  private drawCursorIndicator() {
    const { viewport } = pixiApp;
    const cursor = sheets.sheet.cursor;

    if (viewport.scale.x > HIDE_INDICATORS_BELOW_SCALE) {
      const { codeEditorState } = pixiAppSettings;
      const codeCell = codeEditorState.codeCell;
      const cell = cursor.position;

      const endCell = cursor.bottomRight;
      this.endCell = sheets.sheet.getCellOffsets(endCell.x, endCell.y);

      // draw cursor indicator
      const indicatorSize = Math.max(INDICATOR_SIZE / viewport.scale.x, 4);
      const x = this.endCell.x + this.endCell.width;
      const y = this.endCell.y + this.endCell.height;
      this.indicator.x = x - indicatorSize / 2;
      this.indicator.y = y - indicatorSize / 2;
      this.graphics.lineStyle(0);

      // have cursor color match code editor mode
      let color = pixiApp.accentColor;
      if (
        inlineEditorHandler.getShowing(cell.x, cell.y) ||
        (codeEditorState.showCodeEditor && codeCell.pos.x === cell.x && codeCell.pos.y === cell.y)
      ) {
        color = pixiApp.accentColor;
      }
      this.graphics.beginFill(color).drawShape(this.indicator).endFill();
    }
  }

  private drawCodeCursor(): void {
    let color: number | undefined, offsets: { x: number; y: number; width: number; height: number } | undefined;
    const inlineShowing = inlineEditorHandler.getShowing();
    if (inlineEditorHandler.formula && inlineShowing && sheets.sheet.id === inlineShowing.sheetId) {
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
      const { codeEditorState } = pixiAppSettings;
      const codeCell = codeEditorState.codeCell;
      if (!codeEditorState.showCodeEditor || sheets.sheet.id !== codeCell.sheetId) {
        return;
      }
      offsets = sheets.sheet.getCellOffsets(codeCell.pos.x, codeCell.pos.y);
      color =
        codeCell.language === 'Python'
          ? colors.cellColorUserPython
          : codeCell.language === 'Formula'
          ? colors.cellColorUserFormula
          : codeCell.language === 'Javascript'
          ? colors.cellColorUserJavascript
          : codeCell.language === 'AIResearcher'
          ? colors.cellColorUserAIResearcher
          : colors.independence;
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
        const finiteRanges: CellRefRange[] = cursor.getFiniteRanges();
        this.drawFiniteCursor(finiteRanges);
        const infiniteRanges: CellRefRange[] = cursor.getInfiniteRanges();
        drawInfiniteSelection({
          g: this.graphics,
          color: pixiApp.accentColor,
          alpha: FILL_ALPHA,
          ranges: infiniteRanges,
        });
        if (!columnRow && cursor.rangeCount() === 1 && !cursor.getInfiniteRanges().length) {
          this.drawCursorIndicator();
        }
      }

      if (pixiApp.pointer.pointerDown.unselectDown) {
        this.drawUnselectDown();
      }

      pixiApp.setViewportDirty();
    }
  }
}
