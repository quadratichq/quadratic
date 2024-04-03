import { multiplayer } from '@/multiplayer/multiplayer';
import { Graphics, Rectangle } from 'pixi.js';
import { sheets } from '../../grid/controller/Sheets';
import { Coordinate } from '../types/size';
import { CELL_INPUT_PADDING } from './Cursor';

export const CURSOR_THICKNESS = 1;
const ALPHA = 0.5;
const FILL_ALPHA = 0.01 / ALPHA;

// outside border when editing the cell
const CURSOR_INPUT_ALPHA = 0.333 / ALPHA;

export class UIMultiPlayerCursor extends Graphics {
  dirty = false;

  constructor() {
    super();
    this.alpha = ALPHA;
  }

  // todo: handle multiple people in the same cell
  private drawCursor({
    color,
    cursor,
    editing,
    sessionId,
    code,
  }: {
    color: number;
    cursor: Coordinate;
    editing: boolean;
    sessionId: string;
    code: boolean;
  }): void {
    const sheet = sheets.sheet;
    let { x, y, width, height } = sheet.getCellOffsets(cursor.x, cursor.y);

    if (editing) {
      const cellEdit = document.querySelector(`.multiplayer-cell-edit-${sessionId}`) as HTMLDivElement;
      // it's possible that we run this before react creates the DOM element with this class
      if (cellEdit) {
        if (cellEdit.offsetWidth + CELL_INPUT_PADDING > width) {
          width = Math.max(cellEdit.offsetWidth + CELL_INPUT_PADDING, width);
        }
      }
    }

    // draw cursor)
    this.lineStyle({
      width: CURSOR_THICKNESS,
      color,
      alignment: 0,
    });
    this.drawRect(x, y, width, height);
    if (editing || code) {
      this.lineStyle({
        width: CURSOR_THICKNESS * 1.5,
        color,
        alpha: CURSOR_INPUT_ALPHA,
        alignment: 1,
      });
      this.drawRect(x, y, width, height);
    }
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
      const sheetId = sheets.sheet.id;
      multiplayer.users.forEach((player) => {
        const color = player.color;
        if (player.parsedSelection && player.sheet_id === sheetId) {
          this.drawCursor({
            color,
            cursor: player.parsedSelection.cursor,
            editing: player.cell_edit.active,
            sessionId: player.session_id,
            code: player.cell_edit.code_editor,
          });

          // note: the rectangle is not really a PIXI.Rectangle, but a (x, y, width, height) type (b/c we JSON stringified)
          if (player.parsedSelection.rectangle) {
            this.drawMultiCursor(color, player.parsedSelection.rectangle);
          }
        }
      });
    }
  }
}
