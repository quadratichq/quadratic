//! keyboardPosition() handles the movement of the cursor using the arrow keys,
//! including shift, meta, and ctrl keys.

import { Action } from '@/app/actions/actions';
import { sheets } from '@/app/grid/controller/Sheets';
import { moveViewport, pageUpDown } from '@/app/gridGL/interaction/viewportHelper';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';
import type { Direction } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

function setCursorPosition(x: number, y: number) {
  sheets.sheet.cursor.moveTo(x, y);
}

// handle cases for meta/ctrl keys
async function jumpCursor(direction: Direction, jump: boolean, select: boolean) {
  const cursor = sheets.sheet.cursor;
  const sheetId = sheets.sheet.id;

  const cursorPos = cursor.position;
  const selEnd = cursor.selectionEnd;

  let jumpStartX;
  let jumpStartY;

  switch (direction) {
    case 'Up':
    case 'Down': {
      jumpStartX = cursorPos.x;
      jumpStartY = selEnd.y;
      break;
    }

    case 'Left':
    case 'Right': {
      jumpStartX = selEnd.x;
      jumpStartY = cursorPos.y;
      break;
    }
  }

  const jumpPos = await quadraticCore.jumpCursor(sheetId, { x: jumpStartX, y: jumpStartY }, direction);
  // something went wrong
  if (!jumpPos) {
    console.error('Failed to jump cursor');
    return;
  }

  const jumpCol = Math.max(1, jumpPos.x);
  const jumpRow = Math.max(1, jumpPos.y);

  if (select) {
    switch (direction) {
      case 'Up':
      case 'Down':
        cursor.selectTo(selEnd.x, jumpRow, true);
        break;

      case 'Left':
      case 'Right':
        cursor.selectTo(jumpCol, selEnd.y, true);
        break;
    }
  } else {
    cursor.moveTo(jumpCol, jumpRow);
  }
}

function selectTo(deltaX: number, deltaY: number) {
  const cursor = sheets.sheet.cursor;
  const selectionEnd = cursor.selectionEnd;
  cursor.selectTo(selectionEnd.x + deltaX, selectionEnd.y + deltaY, false);
}

export function keyboardPosition(event: KeyboardEvent): boolean {
  // Move cursor up
  if (matchShortcut(Action.MoveCursorUp, event)) {
    jumpCursor('Up', false, false);
    return true;
  }

  // Move cursor to the top of the content block of cursor cell
  if (matchShortcut(Action.JumpCursorContentTop, event)) {
    jumpCursor('Up', true, false);
    return true;
  }

  // Expand selection up
  if (matchShortcut(Action.ExpandSelectionUp, event)) {
    selectTo(0, -1);
    return true;
  }

  // Expand selection to the top of the content block of cursor cell
  if (matchShortcut(Action.ExpandSelectionContentTop, event)) {
    jumpCursor('Up', true, true);
    return true;
  }

  // Move cursor down
  if (matchShortcut(Action.MoveCursorDown, event)) {
    jumpCursor('Down', false, false);
    return true;
  }

  // Move cursor to the bottom of the content block of cursor cell
  if (matchShortcut(Action.JumpCursorContentBottom, event)) {
    jumpCursor('Down', true, false);
    return true;
  }

  // Expand selection down
  if (matchShortcut(Action.ExpandSelectionDown, event)) {
    selectTo(0, 1);
    return true;
  }

  // Expand selection to the bottom of the content block of cursor cell
  if (matchShortcut(Action.ExpandSelectionContentBottom, event)) {
    jumpCursor('Down', true, true);
    return true;
  }

  // Move cursor left
  if (matchShortcut(Action.MoveCursorLeft, event)) {
    jumpCursor('Left', false, false);
    return true;
  }

  // Move cursor to the left of the content block of cursor cell
  if (matchShortcut(Action.JumpCursorContentLeft, event)) {
    jumpCursor('Left', true, false);
    return true;
  }

  // Expand selection left
  if (matchShortcut(Action.ExpandSelectionLeft, event)) {
    selectTo(-1, 0);
    return true;
  }

  // Expand selection to the left of the content block of cursor cell
  if (matchShortcut(Action.ExpandSelectionContentLeft, event)) {
    jumpCursor('Left', true, true);
    return true;
  }

  // Move cursor right
  if (matchShortcut(Action.MoveCursorRight, event)) {
    jumpCursor('Right', false, false);
    return true;
  }

  // Move cursor to the right of the content block of cursor cell
  if (matchShortcut(Action.JumpCursorContentRight, event)) {
    jumpCursor('Right', true, false);
    return true;
  }

  // Expand selection right
  if (matchShortcut(Action.ExpandSelectionRight, event)) {
    selectTo(1, 0);
    return true;
  }

  // Expand selection to the right of the content block of cursor cell
  if (matchShortcut(Action.ExpandSelectionContentRight, event)) {
    jumpCursor('Right', true, true);
    return true;
  }

  // Move cursor to A0, reset viewport position with A0 at top left
  if (matchShortcut(Action.GotoA1, event)) {
    setCursorPosition(1, 1);
    moveViewport({ topLeft: { x: 0, y: 0 }, force: true });
    return true;
  }

  // Move cursor to the bottom right of the sheet content
  if (matchShortcut(Action.GotoBottomRight, event)) {
    const sheet = sheets.sheet;
    const bounds = sheet.getBounds(true);
    if (bounds) {
      setCursorPosition(bounds.right, bounds.bottom);
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
