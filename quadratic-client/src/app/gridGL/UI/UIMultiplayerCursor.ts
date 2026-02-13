import { events, type DirtyObject } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { drawFiniteSelection, drawInfiniteSelection } from '@/app/gridGL/UI/drawCursor';
import type { JsCoordinate, RefRangeBounds } from '@/app/quadratic-core-types';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { Graphics } from 'pixi.js';

export const CURSOR_THICKNESS = 1;
const ALPHA = 0.5;
const FILL_ALPHA = 0.05;

// outside border when editing the cell
const CURSOR_INPUT_ALPHA = 0.333 / ALPHA;

export class UIMultiPlayerCursor extends Graphics {
  dirty = true;

  constructor() {
    super();
    this.alpha = ALPHA;
    events.on('multiplayerCursor', this.onMultiplayerCursor);
    events.on('setDirty', this.onSetDirty);
    events.on('mergeCells', this.onSheetChanged);
  }

  destroy() {
    events.off('multiplayerCursor', this.onMultiplayerCursor);
    events.off('setDirty', this.onSetDirty);
    events.off('mergeCells', this.onSheetChanged);
    super.destroy();
  }

  private onMultiplayerCursor = () => {
    this.dirty = true;
  };

  private onSetDirty = (dirty: DirtyObject) => {
    if (dirty.multiplayerCursor) {
      this.dirty = true;
    }
  };

  private onSheetChanged = (sheetId: string) => {
    if (sheetId === sheets.current) {
      this.dirty = true;
    }
  };

  private drawCursor({
    color,
    cursor,
    editing,
    sessionId,
    code,
  }: {
    color: number;
    cursor: JsCoordinate;
    editing: boolean;
    sessionId: string;
    code: boolean;
  }) {
    const sheet = sheets.sheet;

    // Check if cursor is on a merged cell and get the full merged cell rect
    const mergeRect = sheet.getMergeCellRect(cursor.x, cursor.y);
    let cellBounds: { x: number; y: number; width: number; height: number };
    if (mergeRect) {
      cellBounds = sheet.getScreenRectangle(
        Number(mergeRect.min.x),
        Number(mergeRect.min.y),
        Number(mergeRect.max.x) - Number(mergeRect.min.x) + 1,
        Number(mergeRect.max.y) - Number(mergeRect.min.y) + 1
      );
    } else {
      cellBounds = sheet.getCellOffsets(cursor.x, cursor.y);
    }

    let { x, y, width, height } = cellBounds;
    if (editing) {
      const cellEdit = document.querySelector(`.multiplayer-cell-edit-${sessionId}`) as HTMLDivElement;
      // it's possible that we run this before react creates the DOM element with this class
      if (cellEdit) {
        if (cellEdit.offsetWidth + CURSOR_THICKNESS * 2 > width) {
          width = Math.max(cellEdit.offsetWidth + CURSOR_THICKNESS * 2, width);
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
      ? [...multiplayer.users].some(([_, player]) => player.parsedSelection?.isColumnRow())
      : false;

    if (!dirtySheet && !this.dirty) {
      return;
    }

    this.dirty = false;
    this.clear();
    const sheetId = sheets.current;
    multiplayer.users.forEach((player) => {
      const color = player.color;
      if (player.parsedSelection && player.sheet_id === sheetId) {
        this.drawCursor({
          color,
          editing: player.cell_edit.active,
          sessionId: player.session_id,
          code: player.cell_edit.code_editor,
          cursor: player.parsedSelection?.getCursor(),
        });

        try {
          const ranges = player.parsedSelection.getFiniteRefRangeBounds(sheets.jsA1Context, sheets.sheet.mergeCells);
          drawFiniteSelection(this, color, FILL_ALPHA, ranges);
        } catch (e) {
          // it's possible for a table to no longer exist, so we don't want to
          // throw a warning or error
        }

        try {
          const infiniteRanges: RefRangeBounds[] = player.parsedSelection.getInfiniteRefRangeBounds();
          drawInfiniteSelection({
            g: this,
            color,
            alpha: FILL_ALPHA,
            ranges: infiniteRanges,
          });
        } catch (e) {
          console.warn(`Unable to draw infinite ranges for player ${player.session_id}, ${e}`);
        }
      }
    });
  }
}
