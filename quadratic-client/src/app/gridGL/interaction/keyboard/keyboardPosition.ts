//! keyboardPosition() handles the movement of the cursor using the arrow keys,
//! including shift, meta, and ctrl keys.

import { Action } from '@/app/actions/actions';
import { sheets } from '@/app/grid/controller/Sheets';
import { ensureVisible, moveViewport, pageUpDown } from '@/app/gridGL/interaction/viewportHelper';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';
import type { Pos } from '@/app/quadratic-core/quadratic_core';
import { Direction, jumpCursor, moveCursor } from '@/app/quadratic-core/quadratic_core';

function setCursorPosition(x: number, y: number) {
  const cursor = sheets.sheet.cursor;
  cursor.moveTo(x, y, { checkForTableRef: true });
}

// handle cases for meta/ctrl keys
async function adjustCursor(direction: Direction, jump: boolean, select: boolean) {
  const cursor = sheets.sheet.cursor;
  const sheetId = sheets.current;

  const cursorPos = cursor.position;
  const selEnd = cursor.selectionEnd;

  let jumpStartX = cursorPos.x;
  let jumpStartY = cursorPos.y;

  if (select) {
    if (direction === Direction.Up || direction === Direction.Down) {
      jumpStartY = selEnd.y;
    } else {
      jumpStartX = selEnd.x;
    }
  }

  let newPos: Pos;
  const dataTablesCache = pixiApp.cellsSheet().tables.dataTablesCache;
  if (!dataTablesCache) {
    console.error('Failed to jump cursor: dataTablesCache is undefined');
    return;
  }
  try {
    if (jump) {
      newPos = jumpCursor(
        sheetId,
        jumpStartX,
        jumpStartY,
        direction,
        sheets.sheet.contentCache,
        dataTablesCache,
        sheets.jsA1Context
      );
    } else {
      newPos = moveCursor(sheetId, jumpStartX, jumpStartY, direction, dataTablesCache, sheets.jsA1Context);
    }
  } catch (e) {
    console.error('Failed to jump cursor', e);
    return;
  }

  const jumpCol = Math.max(1, Number(newPos.x));
  const jumpRow = Math.max(1, Number(newPos.y));

  if (select) {
    switch (direction) {
      case Direction.Up:
      case Direction.Down:
        cursor.selectTo(selEnd.x, jumpRow, true);
        ensureVisible({ x: selEnd.x, y: jumpRow });
        break;

      case Direction.Left:
      case Direction.Right:
        cursor.selectTo(jumpCol, selEnd.y, true);
        ensureVisible({ x: jumpCol, y: selEnd.y });
        break;
    }
  } else {
    cursor.moveTo(jumpCol, jumpRow, { checkForTableRef: true, ensureVisible: { x: jumpCol, y: jumpRow } });
  }
}

function selectTo(deltaX: number, deltaY: number) {
  const cursor = sheets.sheet.cursor;
  const selectionEnd = cursor.selectionEnd;
  cursor.selectTo(Math.max(1, selectionEnd.x + deltaX), Math.max(1, selectionEnd.y + deltaY), false);
}

export function keyboardPosition(event: KeyboardEvent): boolean {
  // Move cursor up
  if (matchShortcut(Action.MoveCursorUp, event)) {
    adjustCursor(Direction.Up, false, false);
    return true;
  }

  // Move cursor to the top of the content block of cursor cell
  if (matchShortcut(Action.JumpCursorContentTop, event)) {
    adjustCursor(Direction.Up, true, false);
    return true;
  }

  // Expand selection up
  if (matchShortcut(Action.ExpandSelectionUp, event)) {
    selectTo(0, -1);
    return true;
  }

  // Expand selection to the top of the content block of cursor cell
  if (matchShortcut(Action.ExpandSelectionContentTop, event)) {
    adjustCursor(Direction.Up, true, true);
    return true;
  }

  // Move cursor down
  if (matchShortcut(Action.MoveCursorDown, event)) {
    adjustCursor(Direction.Down, false, false);
    return true;
  }

  // Move cursor to the bottom of the content block of cursor cell
  if (matchShortcut(Action.JumpCursorContentBottom, event)) {
    adjustCursor(Direction.Down, true, false);
    return true;
  }

  // Expand selection down
  if (matchShortcut(Action.ExpandSelectionDown, event)) {
    selectTo(0, 1);
    return true;
  }

  // Expand selection to the bottom of the content block of cursor cell
  if (matchShortcut(Action.ExpandSelectionContentBottom, event)) {
    adjustCursor(Direction.Down, true, true);
    return true;
  }

  // Move cursor left
  if (matchShortcut(Action.MoveCursorLeft, event)) {
    adjustCursor(Direction.Left, false, false);
    return true;
  }

  // Move cursor to the left of the content block of cursor cell
  if (matchShortcut(Action.JumpCursorContentLeft, event)) {
    adjustCursor(Direction.Left, true, false);
    return true;
  }

  // Expand selection left
  if (matchShortcut(Action.ExpandSelectionLeft, event)) {
    selectTo(-1, 0);
    return true;
  }

  // Expand selection to the left of the content block of cursor cell
  if (matchShortcut(Action.ExpandSelectionContentLeft, event)) {
    adjustCursor(Direction.Left, true, true);
    return true;
  }

  // Move cursor right
  if (matchShortcut(Action.MoveCursorRight, event)) {
    adjustCursor(Direction.Right, false, false);
    return true;
  }

  // Move cursor to the right of the content block of cursor cell
  if (matchShortcut(Action.JumpCursorContentRight, event)) {
    adjustCursor(Direction.Right, true, false);
    return true;
  }

  // Expand selection right
  if (matchShortcut(Action.ExpandSelectionRight, event)) {
    selectTo(1, 0);
    return true;
  }

  // Expand selection to the right of the content block of cursor cell
  if (matchShortcut(Action.ExpandSelectionContentRight, event)) {
    adjustCursor(Direction.Right, true, true);
    return true;
  }

  // Move cursor to A0, reset viewport position with A0 at top left
  if (matchShortcut(Action.GotoA1, event)) {
    setCursorPosition(1, 1);
    moveViewport({ topLeft: { x: 1, y: 1 }, force: true });
    return true;
  }

  // Move cursor to the bottom right of the sheet content
  if (matchShortcut(Action.GotoBottomRight, event)) {
    const sheet = sheets.sheet;
    const bounds = sheet.getBounds(true);
    if (bounds) {
      setCursorPosition(bounds.right - 1, bounds.bottom - 1);
    } else {
      setCursorPosition(1, 1);
    }
    return true;
  }

  // Move cursor to the start of the row content
  if (matchShortcut(Action.GotoRowStart, event)) {
    setCursorPosition(1, sheets.sheet.cursor.position.y);
    return true;
  }

  // Move cursor to the end of the row content
  if (matchShortcut(Action.GotoRowEnd, event)) {
    const sheet = sheets.sheet;
    const bounds = sheet.getBounds(true);
    setCursorPosition(bounds?.right ?? 1, sheets.sheet.cursor.position.y);
    return true;
  }

  // Move viewport up
  if (matchShortcut(Action.PageUp, event)) {
    pageUpDown(true);
    return true;
  }

  // Move viewport down
  if (matchShortcut(Action.PageDown, event)) {
    pageUpDown(false);
    return true;
  }

  return false;
}
