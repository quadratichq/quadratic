import { Graphics, Rectangle } from 'pixi.js';
import { colors } from '../../../theme/colors';
import { PixiApp } from '../pixiApp/PixiApp';

const CURSOR_THICKNESS = 1.5;
const FILL_ALPHA = 0.1;
const INDICATOR_SIZE = 8;
const INDICATOR_PADDING = 1;
const HIDE_INDICATORS_BELOW_SCALE = 0.1;

export class Cursor extends Graphics {
  private app: PixiApp;
  indicator: Rectangle;
  dirty = true;

  constructor(app: PixiApp) {
    super();
    this.app = app;
    this.indicator = new Rectangle();
  }

  private drawCursor(): void {
    const { settings, viewport } = this.app;
    const { gridOffsets } = this.app.sheet;
    const cell = settings.interactionState.cursorPosition;
    const multiCursor = settings.interactionState.showMultiCursor;
    const { x, y, width, height } = gridOffsets.getCell(cell.x, cell.y);
    const color = colors.cursorCell;

    this.lineStyle({
      width: CURSOR_THICKNESS,
      color,
      alignment: 0,
    });

    // draw cursor but leave room for cursor indicator if needed
    const indicatorSize = Math.max(INDICATOR_SIZE / viewport.scale.x, 4);
    this.indicator.width = this.indicator.height = indicatorSize;
    const indicatorPadding = Math.max(INDICATOR_PADDING / viewport.scale.x, 1);
    const terminalPosition = settings.interactionState.multiCursorPosition.terminalPosition;
    const cursorPosition = settings.interactionState.cursorPosition;
    let indicatorOffset = 0;
    if (!multiCursor || (terminalPosition.x === cursorPosition.x && terminalPosition.y === cursorPosition.y)) {
      indicatorOffset = indicatorSize / 2 + indicatorPadding;
    }

    // draw cursor
    this.moveTo(x, y);
    this.lineTo(x + width, y);
    this.lineTo(x + width, y + height - indicatorOffset);
    this.moveTo(x + width - indicatorOffset, y + height);
    this.lineTo(x, y + height);
    this.lineTo(x, y);
  }

  private drawMultiCursor(): void {
    const { settings, viewport } = this.app;
    const { gridOffsets } = this.app.sheet;
    let startCell: { x: number; y: number; width: number; height: number };
    let endCell: { x: number; y: number; width: number; height: number };
    if (settings.interactionState.showMultiCursor) {
      const multiCursor = settings.interactionState.multiCursorPosition;
      this.lineStyle(1, colors.cursorCell, 1, 0, true);
      this.beginFill(colors.cursorCell, FILL_ALPHA);
      startCell = gridOffsets.getCell(multiCursor.originPosition.x, multiCursor.originPosition.y);
      endCell = gridOffsets.getCell(multiCursor.terminalPosition.x, multiCursor.terminalPosition.y);
      this.drawRect(
        startCell.x,
        startCell.y,
        endCell.x + endCell.width - startCell.x,
        endCell.y + endCell.height - startCell.y
      );
    } else {
      startCell = gridOffsets.getCell(
        settings.interactionState.cursorPosition.x,
        settings.interactionState.cursorPosition.y
      );
      endCell = gridOffsets.getCell(
        settings.interactionState.cursorPosition.x,
        settings.interactionState.cursorPosition.y
      );
    }

    if (viewport.scale.x > HIDE_INDICATORS_BELOW_SCALE) {
      // draw cursor indicator
      const indicatorSize = Math.max(INDICATOR_SIZE / viewport.scale.x, 4);
      const x = endCell.x + endCell.width;
      const y = endCell.y + endCell.height;
      this.indicator.x = x - indicatorSize / 2;
      this.indicator.y = y - indicatorSize / 2;
      this.lineStyle(0);
      this.beginFill(colors.cursorCell).drawShape(this.indicator).endFill();
    }
  }

  private drawCodeCursor(): void {
    const { editorInteractionState } = this.app.settings;
    if (editorInteractionState.showCodeEditor) {
      const cell = editorInteractionState.selectedCell;
      const { x, y, width, height } = this.app.sheet.gridOffsets.getCell(cell.x, cell.y);
      const color = editorInteractionState.mode === 'PYTHON' ? colors.cellColorUserPython : colors.independence;
      this.lineStyle({
        width: CURSOR_THICKNESS,
        color,
        alignment: 0,
      });
      this.drawRect(x, y, width - CURSOR_THICKNESS, height - CURSOR_THICKNESS);
    }
  }

  update() {
    if (this.dirty) {
      this.dirty = false;
      this.clear();
      this.drawCursor();
      this.drawMultiCursor();
      this.drawCodeCursor();
    }
  }
}
