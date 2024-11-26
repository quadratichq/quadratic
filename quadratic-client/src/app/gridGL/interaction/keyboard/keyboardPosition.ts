//! keyboardPosition() handles the movement of the cursor using the arrow keys,
//! including shift, meta, and ctrl keys.

import { Action } from '@/app/actions/actions';
import { sheets } from '@/app/grid/controller/Sheets';
import { moveViewport, pageUpDown } from '@/app/gridGL/interaction/viewportHelper';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';
import { JumpDirection } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

function setCursorPosition(x: number, y: number) {
  sheets.sheet.cursor.moveTo(x, y);
}

// todo: The QuadraticCore checks should be a single call within Rust instead of
// having TS handle the logic (this will reduce the number of calls into
// quadraticCore)

// handle cases for meta/ctrl keys with algorithm:
// - if on an empty cell then select to the first cell with a value
// - if on a filled cell then select to the cell before the next empty cell
// - if on a filled cell but the next cell is empty then select to the first cell with a value
// - if there are no more cells then select the next cell over (excel selects to the end of the sheet; we don’t have an end (yet) so right now I select one cell over)
//   the above checks are always made relative to the original cursor position (the highlighted cell)
async function jumpCursor(direction: JumpDirection, select: boolean) {
  const cursor = sheets.sheet.cursor;
  const sheetId = sheets.sheet.id;

  const keyboardX = cursor.position.x;
  const keyboardY = cursor.position.y;

  const position = await quadraticCore.jumpCursor(sheetId, { x: keyboardX, y: keyboardY }, direction);

  // something went wrong
  if (!position) return;

  if (select) {
    cursor.selectTo(position.x, position.y, false);
  } else {
    cursor.moveTo(position.x, position.y);
  }
}

function moveCursor(deltaX: number, deltaY: number) {
  const clamp = sheets.sheet.clamp;
  const cursor = sheets.sheet.cursor;
  const newPos = {
    x: Math.max(clamp.left, cursor.position.x + deltaX),
    y: Math.max(clamp.left, cursor.position.y + deltaY),
  };
  if (newPos.x > clamp.right) {
    newPos.x = clamp.right;
  }
  if (newPos.y > clamp.bottom) {
    newPos.y = clamp.bottom;
  }
  cursor.moveTo(newPos.x, newPos.y);
}

function selectTo(deltaX: number, deltaY: number) {
  const cursor = sheets.sheet.cursor;
  const selectionEnd = cursor.selectionEnd;
  cursor.selectTo(selectionEnd.x + deltaX, selectionEnd.y + deltaY, false);
}

export function keyboardPosition(event: KeyboardEvent): boolean {
  // Move cursor up
  if (matchShortcut(Action.MoveCursorUp, event)) {
    moveCursor(0, -1);
    return true;
  }

  // Move cursor to the top of the content block of cursor cell
  if (matchShortcut(Action.JumpCursorContentTop, event)) {
    jumpCursor('Up', false);
    return true;
  }

  // Expand selection up
  if (matchShortcut(Action.ExpandSelectionUp, event)) {
    selectTo(0, -1);
    return true;
  }

  // Expand selection to the top of the content block of cursor cell
  if (matchShortcut(Action.ExpandSelectionContentTop, event)) {
    jumpCursor('Up', true);
    return true;
  }

  // Move cursor down
  if (matchShortcut(Action.MoveCursorDown, event)) {
    moveCursor(0, 1);
    return true;
  }

  // Move cursor to the bottom of the content block of cursor cell
  if (matchShortcut(Action.JumpCursorContentBottom, event)) {
    jumpCursor('Down', false);
    return true;
  }

  // Expand selection down
  if (matchShortcut(Action.ExpandSelectionDown, event)) {
    selectTo(0, 1);
    return true;
  }

  // Expand selection to the bottom of the content block of cursor cell
  if (matchShortcut(Action.ExpandSelectionContentBottom, event)) {
    jumpCursor('Down', true);
    return true;
  }

  // Move cursor left
  if (matchShortcut(Action.MoveCursorLeft, event)) {
    moveCursor(-1, 0);
    return true;
  }

  // Move cursor to the left of the content block of cursor cell
  if (matchShortcut(Action.JumpCursorContentLeft, event)) {
    jumpCursor('Left', false);
    return true;
  }

  // Expand selection left
  if (matchShortcut(Action.ExpandSelectionLeft, event)) {
    selectTo(-1, 0);
    return true;
  }

  // Expand selection to the left of the content block of cursor cell
  if (matchShortcut(Action.ExpandSelectionContentLeft, event)) {
    jumpCursor('Left', true);
    return true;
  }

  // Move cursor right
  if (matchShortcut(Action.MoveCursorRight, event)) {
    moveCursor(1, 0);
    return true;
  }

  // Move cursor to the right of the content block of cursor cell
  if (matchShortcut(Action.JumpCursorContentRight, event)) {
    jumpCursor('Right', false);
    return true;
  }

  // Expand selection right
  if (matchShortcut(Action.ExpandSelectionRight, event)) {
    selectTo(1, 0);
    return true;
  }

  // Expand selection to the right of the content block of cursor cell
  if (matchShortcut(Action.ExpandSelectionContentRight, event)) {
    jumpCursor('Right', true);
    return true;
  }

  // Move cursor to A0, reset viewport position with A0 at top left
  if (matchShortcut(Action.GotoA0, event)) {
    setCursorPosition(1, 1);
    moveViewport({ topLeft: { x: 0, y: 0 }, force: true });
    return true;
  }

  // Move cursor to the bottom right of the sheet content
  if (matchShortcut(Action.GotoBottomRight, event)) {
    const sheet = sheets.sheet;
    const bounds = sheet.getBounds(true);
    if (bounds) {
      const y = bounds.bottom;
      quadraticCore
        .findNextColumn({
          sheetId: sheet.id,
          columnStart: bounds.right,
          row: y,
          reverse: true,
          withContent: true,
        })
        .then((x) => {
          x = x ?? bounds.right;
          setCursorPosition(x, y);
        });
    }
    return true;
  }

  // Move cursor to the start of the row content
  if (matchShortcut(Action.GotoRowStart, event)) {
    sheets.sheet.cursor.moveTo(1, sheets.sheet.cursor.position.y);
    return true;
  }

  // Move cursor to the end of the row content
  if (matchShortcut(Action.GotoRowEnd, event)) {
    const sheet = sheets.sheet;
    const bounds = sheet.getBounds(true);
    if (bounds) {
      const y = sheet.cursor.position.y;
      quadraticCore
        .findNextColumn({
          sheetId: sheet.id,
          columnStart: bounds.right,
          row: y,
          reverse: true,
          withContent: true,
        })
        .then((x) => {
          x = x ?? bounds.right;
          quadraticCore.cellHasContent(sheet.id, x, y).then((hasContent) => {
            if (hasContent) {
              setCursorPosition(x, y);
            }
          });
        });
    }
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
