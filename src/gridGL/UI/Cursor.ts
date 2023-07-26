import { Graphics, Rectangle } from 'pixi.js';
import { colors } from '../../theme/colors';
import { PixiApp } from '../pixiApp/PixiApp';
import { convertColorStringToTint } from '../../helpers/convertColor';
import { dashedTextures } from '../dashedTextures';
import { getCellFromFormulaNotation, isCellRangeTypeGuard } from '../../helpers/formulaNotation';

export const CURSOR_THICKNESS = 2;
const FILL_ALPHA = 0.1;
const INDICATOR_SIZE = 8;
const INDICATOR_PADDING = 1;
const HIDE_INDICATORS_BELOW_SCALE = 0.1;
const NUM_OF_CELL_REF_COLORS = colors.cellHighlightColor.length;

export type CursorCell = { x: number; y: number; width: number; height: number };
const CURSOR_CELL_DEFAULT_VALUE: CursorCell = { x: 0, y: 0, width: 0, height: 0 };
// adds a bit of padding when editing a cell w/CellInput
const CELL_INPUT_PADDING = CURSOR_THICKNESS * 2;

// outside border when editing the cell
const INPUT_ALPHA = 0.333;

export class Cursor extends Graphics {
  private app: PixiApp;
  indicator: Rectangle;
  dirty = true;

  startCell: CursorCell;
  endCell: CursorCell;

  constructor(app: PixiApp) {
    super();
    this.app = app;
    this.indicator = new Rectangle();

    this.startCell = CURSOR_CELL_DEFAULT_VALUE;
    this.endCell = CURSOR_CELL_DEFAULT_VALUE;
  }

  private drawCursor(): void {
    const { settings, viewport } = this.app;
    const { gridOffsets } = this.app.sheet;
    const { editorInteractionState } = this.app.settings;
    const cell = settings.interactionState.cursorPosition;
    const multiCursor = settings.interactionState.showMultiCursor;
    const showInput = settings.interactionState.showInput;

    let { x, y, width, height } = gridOffsets.getCell(cell.x, cell.y);
    const color = colors.cursorCell;
    const editor_selected_cell = editorInteractionState.selectedCell;

    // draw cursor but leave room for cursor indicator if needed
    const indicatorSize = Math.max(INDICATOR_SIZE / viewport.scale.x, 4);
    this.indicator.width = this.indicator.height = indicatorSize;
    const indicatorPadding = Math.max(INDICATOR_PADDING / viewport.scale.x, 1);
    const terminalPosition = settings.interactionState.multiCursorPosition.terminalPosition;
    const cursorPosition = settings.interactionState.cursorPosition;
    let indicatorOffset = 0;

    // showInput changes after cellEdit is removed from DOM
    const cellEdit = document.querySelector('#cell-edit') as HTMLDivElement;
    if (showInput && cellEdit) {
      if (cellEdit.offsetWidth + CELL_INPUT_PADDING > width) {
        width = Math.max(cellEdit.offsetWidth + CELL_INPUT_PADDING, width);
      }
    } else {
      if (!multiCursor || (terminalPosition.x === cursorPosition.x && terminalPosition.y === cursorPosition.y)) {
        indicatorOffset = indicatorSize / 2 + indicatorPadding;
      }
    }

    // hide cursor if code editor is open and CodeCursor is in the same cell
    if (editorInteractionState.showCodeEditor && editor_selected_cell.x === cell.x && editor_selected_cell.y === cell.y)
      return;

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
        alpha: INPUT_ALPHA,
        alignment: 1,
      });
      this.drawRect(x, y, width, height);
    }
  }

  private drawMultiCursor(): void {
    const { settings } = this.app;
    const { gridOffsets } = this.app.sheet;

    if (settings.interactionState.showMultiCursor) {
      const multiCursor = settings.interactionState.multiCursorPosition;
      this.lineStyle(1, colors.cursorCell, 1, 0, true);
      this.beginFill(colors.cursorCell, FILL_ALPHA);
      this.startCell = gridOffsets.getCell(multiCursor.originPosition.x, multiCursor.originPosition.y);
      this.endCell = gridOffsets.getCell(multiCursor.terminalPosition.x, multiCursor.terminalPosition.y);
      this.drawRect(
        this.startCell.x,
        this.startCell.y,
        this.endCell.x + this.endCell.width - this.startCell.x,
        this.endCell.y + this.endCell.height - this.startCell.y
      );
    } else {
      this.startCell = gridOffsets.getCell(
        settings.interactionState.cursorPosition.x,
        settings.interactionState.cursorPosition.y
      );
      this.endCell = gridOffsets.getCell(
        settings.interactionState.cursorPosition.x,
        settings.interactionState.cursorPosition.y
      );
    }
  }

  private drawCursorIndicator(): void {
    const { viewport } = this.app;

    if (viewport.scale.x > HIDE_INDICATORS_BELOW_SCALE) {
      const { editorInteractionState } = this.app.settings;
      const editor_selected_cell = editorInteractionState.selectedCell;
      const cell = this.app.settings.interactionState.cursorPosition;

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
        editorInteractionState.showCodeEditor &&
        editor_selected_cell.x === cell.x &&
        editor_selected_cell.y === cell.y
      )
        color =
          editorInteractionState.mode === 'PYTHON'
            ? colors.cellColorUserPython
            : editorInteractionState.mode === 'FORMULA'
            ? colors.cellColorUserFormula
            : editorInteractionState.mode === 'AI'
            ? colors.cellColorUserAI
            : colors.cursorCell;
      this.beginFill(color).drawShape(this.indicator).endFill();
    }
  }

  private drawCodeCursor(): void {
    const { editorInteractionState } = this.app.settings;
    if (!editorInteractionState.showCodeEditor) return;
    const cell = editorInteractionState.selectedCell;
    const { x, y, width, height } = this.app.sheet.gridOffsets.getCell(cell.x, cell.y);
    const color =
      editorInteractionState.mode === 'PYTHON'
        ? colors.cellColorUserPython
        : editorInteractionState.mode === 'FORMULA'
        ? colors.cellColorUserFormula
        : editorInteractionState.mode === 'AI'
        ? colors.cellColorUserAI
        : colors.independence;
    this.lineStyle({
      width: CURSOR_THICKNESS * 1.5,
      color,
      alignment: 0.5,
    });

    this.drawRect(x, y, width, height);
  }

  private drawEditorHighlightedCells(): void {
    const { editorHighlightedCellsState, editorInteractionState } = this.app.settings;
    const { highlightedCells, selectedCell } = editorHighlightedCellsState;
    if (!highlightedCells || highlightedCells.size === 0) return;

    let colorIndex = 0;
    for (const [cellRefId] of highlightedCells.entries()) {
      const cell = getCellFromFormulaNotation(
        cellRefId,
        this.app.sheet.gridOffsets,
        editorInteractionState.selectedCell
      );

      if (!cell) continue;
      const colorNumber = convertColorStringToTint(colors.cellHighlightColor[colorIndex % NUM_OF_CELL_REF_COLORS]);
      const isCellRange = isCellRangeTypeGuard(cell);
      this.drawDashedRectangle(
        colorNumber,
        cellRefId === selectedCell,
        isCellRange ? cell.startCell : cell,
        isCellRange ? cell.endCell : undefined
      );
      colorIndex++;
    }
  }

  private drawDashedRectangle(color: number, isSelected: boolean, startCell: CursorCell, endCell?: CursorCell) {
    const minX = Math.min(startCell.x, endCell?.x ?? Infinity);
    const minY = Math.min(startCell.y, endCell?.y ?? Infinity);
    const maxX = Math.max(startCell.width + startCell.x, endCell ? endCell.x + endCell.width : -Infinity);
    const maxY = Math.max(startCell.y + startCell.height, endCell ? endCell.y + endCell.height : -Infinity);

    const path = [
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
      [minX, minY],
    ];

    // have to fill a rect because setting multiple line styles makes it unable to be filled
    if (isSelected) {
      this.lineStyle({
        alignment: 0,
      });
      this.moveTo(minX, minY);
      this.beginFill(color, FILL_ALPHA);
      this.drawRect(minX, minY, maxX - minX, maxY - minY);
      this.endFill();
    }

    this.moveTo(minX, minY);
    for (let i = 0; i < path.length; i++) {
      this.lineStyle({
        width: CURSOR_THICKNESS,
        color,
        alignment: 0,
        texture: i % 2 === 0 ? dashedTextures.dashedHorizontal : dashedTextures.dashedVertical,
      });
      this.lineTo(path[i][0], path[i][1]);
    }
  }

  update() {
    if (this.dirty) {
      this.dirty = false;
      this.clear();
      this.drawCursor();
      if (this.app.settings.interactionState.showInput) return;
      this.drawMultiCursor();
      this.drawCodeCursor();
      this.drawCursorIndicator();
      this.drawEditorHighlightedCells();
    }
  }
}
