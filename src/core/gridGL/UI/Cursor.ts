import { Graphics } from 'pixi.js';
import { colors } from '../../../theme/colors';
import { PixiApp } from '../pixiApp/PixiApp';

const CURSOR_THICKNESS = 1.5;
const FILL_ALPHA = 0.1;
const INDICATOR_SIZE = 8;
const INDICATOR_PADDING = 1;

export class Cursor extends Graphics {
  private app: PixiApp;
  dirty = true;

  constructor(app: PixiApp) {
    super();
    this.app = app;
  }

  private drawCursor(): void {
    const { settings, gridOffsets } = this.app;
    const cell = settings.interactionState.cursorPosition;
    const { x, y, width, height } = gridOffsets.getCell(cell.x, cell.y);
    const color = colors.cursorCell;

    this.lineStyle({
      width: CURSOR_THICKNESS,
      color,
      alignment: 0,
    });
    this.drawRect(x, y, width, height);
  }

  private drawMultiCursor(): void {
    const { settings, gridOffsets, viewport } = this.app;
    let endCell: { x: number, y: number, width: number, height: number };
    if (settings.interactionState.showMultiCursor) {
      const multiCursor = settings.interactionState.multiCursorPosition;
      this.lineStyle(1, colors.cursorCell, 1, 0, true);
      this.beginFill(colors.cursorCell, FILL_ALPHA);
      const startCell = gridOffsets.getCell(multiCursor.originPosition.x, multiCursor.originPosition.y);
      endCell = gridOffsets.getCell(multiCursor.terminalPosition.x, multiCursor.terminalPosition.y);
      this.drawRect(
        startCell.x,
        startCell.y,
        endCell.x + endCell.width - startCell.x,
        endCell.y + endCell.height - startCell.y,
      );
    } else {
      endCell = gridOffsets.getCell(settings.interactionState.cursorPosition.x, settings.interactionState.cursorPosition.y);
    }

    // draw cursor indicator
    const size = Math.max(INDICATOR_SIZE / viewport.scale.x, 4);
    const padding = Math.max(INDICATOR_PADDING / viewport.scale.x, 1);
    const x = endCell.x + endCell.width;
    const y = endCell.y + endCell.height;
    this.lineStyle(0);
    this.beginFill(0xffffff).drawRect(x - size / 2 - padding, y - size / 2 - padding, size + padding, size + padding).endFill();
    this.beginFill(colors.cursorCell).drawRect(x - size / 2, y - size / 2, size, size).endFill();
  }

  private drawCodeCursor(): void {
    const { editorInteractionState } = this.app.settings;
    if (editorInteractionState.showCodeEditor) {
      const cell = editorInteractionState.selectedCell;
      const { x, y, width, height } = this.app.gridOffsets.getCell(cell.x, cell.y);
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
