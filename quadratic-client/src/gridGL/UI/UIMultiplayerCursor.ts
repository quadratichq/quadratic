import { multiplayer } from '@/multiplayer/multiplayer';
import { MULTIPLAYER_COLORS_TINT } from '@/multiplayer/multiplayerCursor/multiplayerColors';
import { Graphics, Rectangle } from 'pixi.js';
import { sheets } from '../../grid/controller/Sheets';
import { pixiApp } from '../pixiApp/PixiApp';
import { Coordinate } from '../types/size';

export const CURSOR_THICKNESS = 1;
const ALPHA = 0.5;
const FILL_ALPHA = 0.01 / ALPHA;

export class UIMultiPlayerCursor extends Graphics {
  dirty = false;

  constructor() {
    super();
    this.alpha = ALPHA;
  }

  // todo: handle multiple people in the same cell
  private drawCursor(color: number, cursor: Coordinate) {
    const sheet = sheets.sheet;

    let { x, y, width, height } = sheet.getCellOffsets(cursor.x, cursor.y);

    // draw cursor
    this.lineStyle({
      width: CURSOR_THICKNESS,
      color,
      alignment: 0,
    });
    this.moveTo(x, y);
    this.lineTo(x + width, y);
    this.lineTo(x + width, y + height);
    this.moveTo(x + width, y + height);
    this.lineTo(x, y + height);
    this.lineTo(x, y);
  }

  private drawMultiCursor(color: number, rectangle: Rectangle): void {
    const sheet = sheets.sheet;
    this.lineStyle(1, color, 1, 0, true);
    this.beginFill(color, FILL_ALPHA);
    const startCell = sheet.getCellOffsets(rectangle.x, rectangle.y);
    const endCell = sheet.getCellOffsets(rectangle.x + rectangle.width, rectangle.y + rectangle.height);
    this.drawRect(
      startCell.x,
      startCell.y,
      endCell.x + endCell.width - startCell.x,
      endCell.y + endCell.height - startCell.y
    );
  }

  update() {
    if (this.dirty) {
      this.dirty = false;
      this.clear();
      // const sheetId = sheets.sheet.id;
      multiplayer.users.forEach((player) => {
        const color = MULTIPLAYER_COLORS_TINT[player.color];
        if (player.selection /* && player.sheetId === sheetId */) {
          this.drawCursor(color, player.selection.cursor);

          // note: the rectangle is not really a PIXI.Rectangle, but a (x, y, width, height) type (b/c we JSON stringified)
          if (player.selection.rectangle) {
            this.drawMultiCursor(color, player.selection.rectangle);
          }
        }
      });
      pixiApp.setViewportDirty();
    }
  }
}
