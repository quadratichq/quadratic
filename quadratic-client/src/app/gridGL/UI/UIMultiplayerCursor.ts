import { Graphics } from 'pixi.js';

import { sheets } from '@/app/grid/controller/Sheets';
import type { Coordinate } from '@/app/gridGL/types/size';
import { CELL_INPUT_PADDING } from '@/app/gridGL/UI/Cursor';
import { drawColumnRowCursor, drawMultiCursor } from '@/app/gridGL/UI/drawCursor';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';

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
  }) {
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

  update(viewportDirty: boolean) {
    // we need to update the multiplayer cursor if a player has selected a row,
    // column, or the sheet, and the viewport has changed
    const dirtySheet = viewportDirty
      ? [...multiplayer.users].some(([_, player]) => player.parsedSelection?.columnRow)
      : false;

    if (dirtySheet || this.dirty) {
      this.dirty = false;
      this.clear();
      const sheetId = sheets.sheet.id;
      multiplayer.users.forEach((player) => {
        const color = player.color;
        if (player.parsedSelection && player.sheet_id === sheetId) {
          this.drawCursor({
            color,
            cursor: player.parsedSelection.cursorPosition,
            editing: player.cell_edit.active,
            sessionId: player.session_id,
            code: player.cell_edit.code_editor,
          });

          const columnRow = player.parsedSelection.columnRow;
          if (columnRow) {
            drawColumnRowCursor({
              g: this,
              color,
              alpha: FILL_ALPHA,
              cursorPosition: player.parsedSelection.cursorPosition,
              columnRow,
            });
          } else if (player.parsedSelection.multiCursor) {
            drawMultiCursor(this, color, FILL_ALPHA, player.parsedSelection.multiCursor);
          }
        }
      });
    }
  }
}
