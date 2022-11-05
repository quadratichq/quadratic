import { Graphics } from 'pixi.js';
import { colors } from '../../../theme/colors';
import { PixiApp } from '../pixiApp/PixiApp';

const CURSOR_THICKNESS = 1.5;
const FILL_ALPHA = 0.1;

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
    let color: number;
    if (settings.editorInteractionState.showCodeEditor) {
      color = settings.editorInteractionState.mode === 'PYTHON' ? colors.cellColorUserPython : colors.independence;
    } else {
      color = colors.cursorCell;
    }

    this.lineStyle({
      width: CURSOR_THICKNESS,
      color,
      alignment: 0,
    });
    this.drawRect(x, y, width, height);
  }

  private drawMultiCursor(): void {
    const { settings, gridOffsets } = this.app;
    if (settings.interactionState.showMultiCursor) {
      const multiCursor = settings.interactionState.multiCursorPosition;
      this.lineStyle(1, colors.cursorCell, 1, 0, true);
      this.beginFill(colors.cursorCell, FILL_ALPHA);
      const startCell = gridOffsets.getCell(multiCursor.originPosition.x, multiCursor.originPosition.y);
      const endCell = gridOffsets.getCell(multiCursor.terminalPosition.x, multiCursor.terminalPosition.y);
      this.drawRect(
        startCell.x,
        startCell.y,
        endCell.x + endCell.width - startCell.x,
        endCell.y + endCell.height - startCell.y
      );
    }
  }

  update() {
    if (this.dirty) {
      this.dirty = false;
      this.clear();
      this.drawCursor();
      this.drawMultiCursor();
    }
  }
}
