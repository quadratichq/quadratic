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
    const { settings, gridOffsets, viewport } = this.app;
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
    const indicatorPadding = Math.max(INDICATOR_PADDING / viewport.scale.x, 1);
    const xOffset = !multiCursor ? indicatorSize / 2 + indicatorPadding : 0;
    const yOffset = !multiCursor ? indicatorSize / 2 + indicatorPadding : 0;
    this.moveTo(x, y);
    this.lineTo(x + width, y);
    this.lineTo(x + width, y + height - yOffset);
    this.moveTo(x + width - xOffset, y + height);
    this.lineTo(x, y + height);
    this.lineTo(x, y);
  }

  private drawMultiCursor(): void {
    const { settings, gridOffsets, viewport } = this.app;
    let endCell: { x: number; y: number; width: number; height: number };
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
        endCell.y + endCell.height - startCell.y
      );
    } else {
      endCell = gridOffsets.getCell(
        settings.interactionState.cursorPosition.x,
        settings.interactionState.cursorPosition.y
      );
    }

    // draw cursor indicator
    const indicatorSize = Math.max(INDICATOR_SIZE / viewport.scale.x, 4);
    const x = endCell.x + endCell.width;
    const y = endCell.y + endCell.height;
    this.lineStyle(0);
    this.beginFill(colors.cursorCell)
      .drawRect(x - indicatorSize / 2, y - indicatorSize / 2, indicatorSize, indicatorSize)
      .endFill();
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
