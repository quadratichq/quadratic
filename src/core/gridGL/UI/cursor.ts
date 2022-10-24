import { Graphics } from 'pixi.js';
import { colors } from '../../../theme/colors';
import { PixiApp } from '../pixiApp/PixiApp';

const CURSOR_THICKNESS = 1.5;

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
    const { width } = gridOffsets.getColumnPlacement(cell.x);
    const { height } = gridOffsets.getRowPlacement(cell.y);
    let color: number;
    if (settings.editorInteractionState.showCodeEditor) {
      color = settings.editorInteractionState.mode === 'PYTHON' ? colors.cellColorUserPython : colors.independence;
    } else {
      color = colors.cursorCell;
    }

    this.clear();
    this.lineStyle({
      width: CURSOR_THICKNESS,
      color,
      alignment: 0
    });
    this.drawRect(cell.x, cell.y, width, height);
  }

  update() {
    if (this.dirty) {
      this.dirty = false;
      this.drawCursor();
    }
  }
}