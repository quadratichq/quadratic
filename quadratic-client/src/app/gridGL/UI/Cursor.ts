import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { Graphics, Rectangle } from 'pixi.js';
import { hasPermissionToEditFile } from '../../actions';
import { sheets } from '../../grid/controller/Sheets';
import { colors } from '../../theme/colors';
import { pixiApp } from '../pixiApp/PixiApp';
import { pixiAppSettings } from '../pixiApp/PixiAppSettings';

export const CURSOR_THICKNESS = 2;
export const FILL_ALPHA = 0.1;

const INDICATOR_SIZE = 8;
const INDICATOR_PADDING = 1;
const HIDE_INDICATORS_BELOW_SCALE = 0.1;

export type CursorCell = { x: number; y: number; width: number; height: number };
const CURSOR_CELL_DEFAULT_VALUE: CursorCell = { x: 0, y: 0, width: 0, height: 0 };

// adds a bit of padding when editing a cell w/CellInput
export const CELL_INPUT_PADDING = CURSOR_THICKNESS * 2;
const CELL_EDIT_VERTICAL_PADDING = 4;

// outside border when editing the cell
const CURSOR_INPUT_ALPHA = 0.333;

export class Cursor extends Graphics {
  indicator: Rectangle;
  dirty = true;

  startCell: CursorCell;
  endCell: CursorCell;

  cursorRectangle?: Rectangle;

  constructor() {
    super();
    this.indicator = new Rectangle();

    this.startCell = CURSOR_CELL_DEFAULT_VALUE;
    this.endCell = CURSOR_CELL_DEFAULT_VALUE;
    this.cursorRectangle = new Rectangle();
  }

  private drawCursor(): void {
    const sheet = sheets.sheet;
    const cursor = sheet.cursor;
    const { viewport } = pixiApp;
    const { editorInteractionState } = pixiAppSettings;
    const cell = cursor.cursorPosition;
    const showInput = pixiAppSettings.input.show;

    let { x, y, width, height } = sheet.getCellOffsets(cell.x, cell.y);
    const color = colors.cursorCell;
    const editor_selected_cell = editorInteractionState.selectedCell;

    // draw cursor but leave room for cursor indicator if needed
    const indicatorSize = hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions)
      ? Math.max(INDICATOR_SIZE / viewport.scale.x, 4)
      : 0;
    this.indicator.width = this.indicator.height = indicatorSize;
    const indicatorPadding = Math.max(INDICATOR_PADDING / viewport.scale.x, 1);
    const cursorPosition = cursor.cursorPosition;
    let indicatorOffset = 0;

    // showInput changes after cellEdit is removed from DOM
    const cellEdit = document.querySelector('#cell-edit') as HTMLDivElement;
    if (showInput) {
      if (cellEdit) {
        width = Math.max(cellEdit.offsetWidth + CELL_INPUT_PADDING, width);
        height = Math.max(cellEdit.offsetHeight + CELL_EDIT_VERTICAL_PADDING, height);
      } else {
        // we have to wait until react renders #cell-edit to properly calculate the width
        setTimeout(() => (this.dirty = true), 0);
      }
    } else {
      if (
        !cursor.multiCursor ||
        (cursor.multiCursor.terminalPosition.x === cursorPosition.x &&
          cursor.multiCursor.terminalPosition.y === cursorPosition.y)
      ) {
        indicatorOffset = indicatorSize / 2 + indicatorPadding;
      }
    }

    // hide cursor if code editor is open and CodeCursor is in the same cell
    if (
      editorInteractionState.showCodeEditor &&
      editor_selected_cell.x === cell.x &&
      editor_selected_cell.y === cell.y
    ) {
      this.cursorRectangle = undefined;
      return;
    }

    // draw cursor
    this.lineStyle({
      width: CURSOR_THICKNESS,
      color,
      alignment: 0,
    });
    this.moveTo(x, y);
    this.lineTo(x + width, y);
    this.lineTo(x + width, y + height - indicatorOffset);
    this.moveTo(x + width - indicatorOffset, y + height);
    this.lineTo(x, y + height);
    this.lineTo(x, y);

    if (showInput && cellEdit) {
      this.lineStyle({
        width: CURSOR_THICKNESS * 1.5,
        color,
        alpha: CURSOR_INPUT_ALPHA,
        alignment: 1,
      });
      this.drawRect(x, y, width, height);
      this.cursorRectangle = undefined;
    } else {
      this.cursorRectangle = new Rectangle(x, y, width, height);
    }
  }

  private drawMultiCursor(): void {
    const sheet = sheets.sheet;
    const { cursor } = sheet;

    if (cursor.multiCursor) {
      this.lineStyle(1, colors.cursorCell, 1, 0, true);
      this.beginFill(colors.cursorCell, FILL_ALPHA);
      this.startCell = sheet.getCellOffsets(cursor.originPosition.x, cursor.originPosition.y);
      this.endCell = sheet.getCellOffsets(cursor.terminalPosition.x, cursor.terminalPosition.y);
      this.cursorRectangle = new Rectangle(
        this.startCell.x,
        this.startCell.y,
        this.endCell.x + this.endCell.width - this.startCell.x,
        this.endCell.y + this.endCell.height - this.startCell.y
      );
      this.drawShape(this.cursorRectangle);
    } else {
      this.startCell = sheet.getCellOffsets(cursor.cursorPosition.x, cursor.cursorPosition.y);
      this.endCell = sheet.getCellOffsets(cursor.cursorPosition.x, cursor.cursorPosition.y);
      this.cursorRectangle = new Rectangle(
        this.startCell.x,
        this.startCell.y,
        this.endCell.width - this.startCell.width,
        this.endCell.height - this.startCell.height
      );
    }
  }

  private drawCursorIndicator(): void {
    const { viewport } = pixiApp;
    const cursor = sheets.sheet.cursor;

    if (viewport.scale.x > HIDE_INDICATORS_BELOW_SCALE) {
      const { editorInteractionState } = pixiAppSettings;
      const editor_selected_cell = editorInteractionState.selectedCell;
      const cell = cursor.cursorPosition;

      // draw cursor indicator
      const indicatorSize = Math.max(INDICATOR_SIZE / viewport.scale.x, 4);
      const x = this.endCell.x + this.endCell.width;
      const y = this.endCell.y + this.endCell.height;
      this.indicator.x = x - indicatorSize / 2;
      this.indicator.y = y - indicatorSize / 2;
      this.lineStyle(0);
      // have cursor color match code editor mode
      let color = colors.cursorCell;
      if (
        inlineEditorHandler.getShowing(cell.x, cell.y) ||
        (editorInteractionState.showCodeEditor &&
          editor_selected_cell.x === cell.x &&
          editor_selected_cell.y === cell.y)
      )
        color =
          editorInteractionState.mode === 'Python'
            ? colors.cellColorUserPython
            : editorInteractionState.mode === 'Formula'
            ? colors.cellColorUserFormula
            : colors.cursorCell;
      this.beginFill(color).drawShape(this.indicator).endFill();
    }
  }

  private drawCodeCursor(): void {
    let color: number | undefined, offsets: { x: number; y: number; width: number; height: number } | undefined;
    const inlineShowing = inlineEditorHandler.getShowing();
    if (inlineEditorHandler.formula && inlineShowing && sheets.sheet.id === inlineShowing.sheetId) {
      color = colors.cellColorUserFormula;
      offsets = sheets.sheet.getCellOffsets(inlineShowing.x, inlineShowing.y);
      offsets.width = inlineEditorHandler.width + CURSOR_THICKNESS * 2;
      offsets.height = inlineEditorHandler.height;
    } else {
      const { editorInteractionState } = pixiAppSettings;
      const cell = editorInteractionState.selectedCell;
      if (!editorInteractionState.showCodeEditor || sheets.sheet.id !== editorInteractionState.selectedCellSheet) {
        return;
      }
      offsets = sheets.sheet.getCellOffsets(cell.x, cell.y);
      color =
        editorInteractionState.mode === 'Python'
          ? colors.cellColorUserPython
          : editorInteractionState.mode === 'Formula'
          ? colors.cellColorUserFormula
          : colors.independence;
    }
    if (!color || !offsets) return;
    this.lineStyle({
      width: CURSOR_THICKNESS * 1.5,
      color,
      alignment: 0.5,
    });
    this.drawRect(offsets.x, offsets.y, offsets.width, offsets.height);
  }

  update() {
    if (this.dirty) {
      this.dirty = false;
      this.clear();
      if (!inlineEditorHandler.isEditingFormula()) {
        this.drawCursor();
      }
      this.drawCodeCursor();

      if (!pixiAppSettings.input.show) {
        this.drawMultiCursor();
        this.drawCursorIndicator();
      }

      pixiApp.setViewportDirty();
    }
  }
}
