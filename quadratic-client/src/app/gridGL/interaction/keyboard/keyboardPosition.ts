//! keyboardPosition() handles the movement of the cursor using the arrow keys,
//! including shift, meta, and ctrl keys.

import { Action } from '@/app/actions/actions';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { moveViewport, pageUpDown } from '@/app/gridGL/interaction/viewportHelper';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Rectangle } from 'pixi.js';

function setCursorPosition(x: number, y: number) {
  const newPos = { x, y };
  sheets.sheet.cursor.changePosition({
    multiCursor: null,
    columnRow: null,
    cursorPosition: newPos,
    keyboardMovePosition: newPos,
    ensureVisible: newPos,
  });
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
async function jumpCursor(deltaX: number, deltaY: number, select: boolean) {
  const sheet = sheets.sheet;
  const cursor = sheet.cursor;
  const sheetId = sheet.id;
  const clamp = sheet.clamp;

  // holds either the existing multiCursor or creates a new one based on cursor position
  const multiCursor = cursor.multiCursor ?? [new Rectangle(cursor.position.x, cursor.position.y, 1, 1)];

  // the last multiCursor entry, which is what we change with the keyboard
  const lastMultiCursor = multiCursor[multiCursor.length - 1];
  const keyboardX = cursor.keyboardMovePosition.x;
  const keyboardY = cursor.keyboardMovePosition.y;

  if (deltaX === 1) {
    let x = keyboardX;
    const y = cursor.keyboardMovePosition.y;
    // always use the original cursor position to search
    const yCheck = cursor.position.y;
    // handle case of cell with content
    let nextCol: number | undefined = undefined;
    if (await quadraticCore.cellHasContent(sheetId, x, yCheck)) {
      // if next cell is empty, find the next cell with content
      if (!(await quadraticCore.cellHasContent(sheetId, x + 1, yCheck))) {
        nextCol = await quadraticCore.findNextColumn({
          sheetId,
          columnStart: x + 2,
          row: yCheck,
          reverse: false,
          withContent: true,
        });
      }
      // if next cell is not empty, find the next empty cell
      else {
        nextCol =
          ((await quadraticCore.findNextColumn({
            sheetId,
            columnStart: x + 2,
            row: yCheck,
            reverse: false,
            withContent: false,
          })) ?? x + 2) - 1;
      }
    }
    // otherwise find the next cell with content
    else {
      nextCol = await quadraticCore.findNextColumn({
        sheetId,
        columnStart: x + 1,
        row: yCheck,
        reverse: false,
        withContent: true,
      });
    }
    if (nextCol === undefined) {
      nextCol = x + 1 < clamp.left ? clamp.left : x + 1;
    }
    nextCol = Math.min(nextCol, clamp.right);
    x = nextCol;
    if (x === keyboardX) x++;
    if (select) {
      lastMultiCursor.x = Math.min(cursor.position.x, x);
      lastMultiCursor.width = Math.abs(cursor.position.x - x) + 1;
      cursor.changePosition({
        multiCursor,
        keyboardMovePosition: { x, y },
        ensureVisible: { x: lastMultiCursor.right, y },
      });
    } else {
      setCursorPosition(x, y);
    }
  } else if (deltaX === -1) {
    let x = keyboardX;
    const y = cursor.keyboardMovePosition.y;
    // always use the original cursor position to search
    const yCheck = cursor.position.y;
    // handle case of cell with content
    let nextCol: number | undefined = undefined;
    if (await quadraticCore.cellHasContent(sheetId, x, yCheck)) {
      // if next cell is empty, find the next cell with content
      if (!(await quadraticCore.cellHasContent(sheetId, x - 1, yCheck))) {
        nextCol = await quadraticCore.findNextColumn({
          sheetId,
          columnStart: x - 2,
          row: yCheck,
          reverse: true,
          withContent: true,
        });
      }
      // if next cell is not empty, find the next empty cell
      else {
        nextCol =
          ((await quadraticCore.findNextColumn({
            sheetId,
            columnStart: x - 2,
            row: yCheck,
            reverse: true,
            withContent: false,
          })) ?? x - 2) + 1;
      }
    }
    // otherwise find the next cell with content
    else {
      nextCol = await quadraticCore.findNextColumn({
        sheetId,
        columnStart: x - 1,
        row: yCheck,
        reverse: true,
        withContent: true,
      });
    }
    if (nextCol === undefined) {
      nextCol = x > 0 ? 0 : x - 1;
    }
    x = nextCol;
    if (keyboardX > 0) {
      x = Math.max(x, 0);
    }
    if (x === keyboardX) x--;
    x = Math.max(x, clamp.left);
    if (select) {
      lastMultiCursor.x = Math.min(cursor.position.x, x);
      lastMultiCursor.width = Math.abs(cursor.position.x - x) + 1;
      cursor.changePosition({
        multiCursor,
        keyboardMovePosition: { x, y },
        ensureVisible: { x: lastMultiCursor.x, y },
      });
    } else {
      setCursorPosition(x, y);
    }
  } else if (deltaY === 1) {
    let y = keyboardY;
    const x = cursor.keyboardMovePosition.x;
    // always use the original cursor position to search
    const xCheck = cursor.position.x;
    // handle case of cell with content
    let nextRow: number | undefined = undefined;
    if (await quadraticCore.cellHasContent(sheetId, xCheck, y)) {
      // if next cell is empty, find the next cell with content
      if (!(await quadraticCore.cellHasContent(sheetId, xCheck, y + 1))) {
        nextRow = await quadraticCore.findNextRow({
          sheetId,
          column: xCheck,
          rowStart: y + 2,
          reverse: false,
          withContent: true,
        });
      }
      // if next cell is not empty, find the next empty cell
      else {
        nextRow =
          ((await quadraticCore.findNextRow({
            sheetId,
            column: xCheck,
            rowStart: y + 2,
            reverse: false,
            withContent: false,
          })) ?? y + 2) - 1;
      }
    }
    // otherwise find the next cell with content
    else {
      nextRow = await quadraticCore.findNextRow({
        sheetId,
        column: xCheck,
        rowStart: y + 1,
        reverse: false,
        withContent: true,
      });
    }
    if (nextRow === undefined) {
      nextRow = y < 0 ? 0 : y + 1;
    }
    y = nextRow;
    if (y === keyboardY) y++;
    y = Math.max(y, clamp.top);
    if (select) {
      lastMultiCursor.y = Math.min(cursor.position.y, y);
      lastMultiCursor.height = Math.abs(cursor.position.y - y) + 1;
      cursor.changePosition({
        multiCursor,
        keyboardMovePosition: { x, y },
        ensureVisible: { x, y: lastMultiCursor.bottom },
      });
    } else {
      setCursorPosition(x, y);
    }
  } else if (deltaY === -1) {
    let y = keyboardY;
    const x = cursor.keyboardMovePosition.x;
    // always use the original cursor position to search
    const xCheck = cursor.position.x;
    // handle case of cell with content
    let nextRow: number | undefined = undefined;
    if (await quadraticCore.cellHasContent(sheetId, xCheck, y)) {
      // if next cell is empty, find the next cell with content
      if (!(await quadraticCore.cellHasContent(sheetId, xCheck, y - 1))) {
        nextRow = await quadraticCore.findNextRow({
          sheetId,
          column: xCheck,
          rowStart: y - 2,
          reverse: true,
          withContent: true,
        });
      }
      // if next cell is not empty, find the next empty cell
      else {
        nextRow =
          ((await quadraticCore.findNextRow({
            sheetId,
            column: xCheck,
            rowStart: y - 2,
            reverse: true,
            withContent: false,
          })) ?? y - 2) + 1;
      }
    }
    // otherwise find the next cell with content
    else {
      nextRow = await quadraticCore.findNextRow({
        sheetId,
        column: xCheck,
        rowStart: y - 1,
        reverse: true,
        withContent: true,
      });
    }
    if (nextRow === undefined) {
      nextRow = y > 0 ? 0 : y - 1;
    }
    y = nextRow;
    if (keyboardY > 0) {
      y = Math.max(y, 0);
    }
    if (y === keyboardY) y--;
    y = Math.max(y, clamp.top);
    if (select) {
      lastMultiCursor.y = Math.min(cursor.position.y, y);
      lastMultiCursor.height = Math.abs(cursor.position.y - y) + 1;
      cursor.changePosition({
        multiCursor,
        keyboardMovePosition: { x, y },
        ensureVisible: { x, y: lastMultiCursor.y },
      });
    } else {
      setCursorPosition(x, y);
    }
  }
}

// use arrow to select when shift key is pressed
function expandSelection(deltaX: number, deltaY: number) {
  const clamp = sheets.sheet.clamp;
  const cursor = sheets.sheet.cursor;

  const downPosition = cursor.position;
  const movePosition = cursor.keyboardMovePosition;

  // holds either the existing multiCursor or creates a new one based on cursor position
  const multiCursor = cursor.multiCursor ?? [new Rectangle(cursor.position.x, cursor.position.y, 1, 1)];

  // the last multiCursor entry, which is what we change with the keyboard
  const lastMultiCursor = multiCursor[multiCursor.length - 1];

  const newMovePosition = { x: movePosition.x + deltaX, y: movePosition.y + deltaY };
  lastMultiCursor.x = downPosition.x < newMovePosition.x ? downPosition.x : newMovePosition.x;
  lastMultiCursor.y = downPosition.y < newMovePosition.y ? downPosition.y : newMovePosition.y;
  lastMultiCursor.width = Math.abs(newMovePosition.x - downPosition.x) + 1;
  lastMultiCursor.height = Math.abs(newMovePosition.y - downPosition.y) + 1;
  if (lastMultiCursor.x < clamp.left) {
    lastMultiCursor.width -= clamp.left - lastMultiCursor.x;
    lastMultiCursor.x = clamp.left;
  }
  if (lastMultiCursor.y < clamp.top) {
    lastMultiCursor.height -= clamp.top - lastMultiCursor.y;
    lastMultiCursor.y = clamp.top;
  }
  if (lastMultiCursor.right > clamp.right) {
    lastMultiCursor.width -= lastMultiCursor.right - clamp.right;
  }
  if (lastMultiCursor.bottom > clamp.bottom) {
    lastMultiCursor.height -= lastMultiCursor.bottom - clamp.bottom;
  }
  cursor.changePosition({
    columnRow: null,
    multiCursor,
    keyboardMovePosition: newMovePosition,
    ensureVisible: { x: newMovePosition.x, y: newMovePosition.y },
  });
  if (!inlineEditorHandler.cursorIsMoving) {
    pixiAppSettings.changeInput(false);
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
  cursor.changePosition({
    columnRow: null,
    multiCursor: null,
    keyboardMovePosition: newPos,
    cursorPosition: newPos,
  });
}

export function keyboardPosition(event: KeyboardEvent): boolean {
  // Move cursor up
  if (matchShortcut(Action.MoveCursorUp, event)) {
    moveCursor(0, -1);
    return true;
  }

  // Move cursor to the top of the content block of cursor cell
  if (matchShortcut(Action.JumpCursorContentTop, event)) {
    jumpCursor(0, -1, false);
    return true;
  }

  // Expand selection up
  if (matchShortcut(Action.ExpandSelectionUp, event)) {
    expandSelection(0, -1);
    return true;
  }

  // Expand selection to the top of the content block of cursor cell
  if (matchShortcut(Action.ExpandSelectionContentTop, event)) {
    jumpCursor(0, -1, true);
    return true;
  }

  // Move cursor down
  if (matchShortcut(Action.MoveCursorDown, event)) {
    moveCursor(0, 1);
    return true;
  }

  // Move cursor to the bottom of the content block of cursor cell
  if (matchShortcut(Action.JumpCursorContentBottom, event)) {
    jumpCursor(0, 1, false);
    return true;
  }

  // Expand selection down
  if (matchShortcut(Action.ExpandSelectionDown, event)) {
    expandSelection(0, 1);
    return true;
  }

  // Expand selection to the bottom of the content block of cursor cell
  if (matchShortcut(Action.ExpandSelectionContentBottom, event)) {
    jumpCursor(0, 1, true);
    return true;
  }

  // Move cursor left
  if (matchShortcut(Action.MoveCursorLeft, event)) {
    moveCursor(-1, 0);
    return true;
  }

  // Move cursor to the left of the content block of cursor cell
  if (matchShortcut(Action.JumpCursorContentLeft, event)) {
    jumpCursor(-1, 0, false);
    return true;
  }

  // Expand selection left
  if (matchShortcut(Action.ExpandSelectionLeft, event)) {
    expandSelection(-1, 0);
    return true;
  }

  // Expand selection to the left of the content block of cursor cell
  if (matchShortcut(Action.ExpandSelectionContentLeft, event)) {
    jumpCursor(-1, 0, true);
    return true;
  }

  // Move cursor right
  if (matchShortcut(Action.MoveCursorRight, event)) {
    moveCursor(1, 0);
    return true;
  }

  // Move cursor to the right of the content block of cursor cell
  if (matchShortcut(Action.JumpCursorContentRight, event)) {
    jumpCursor(1, 0, false);
    return true;
  }

  // Expand selection right
  if (matchShortcut(Action.ExpandSelectionRight, event)) {
    expandSelection(1, 0);
    return true;
  }

  // Expand selection to the right of the content block of cursor cell
  if (matchShortcut(Action.ExpandSelectionContentRight, event)) {
    jumpCursor(1, 0, true);
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
    sheets.sheet.cursor.changePosition({
      columnRow: null,
      cursorPosition: { x: 1, y: sheets.sheet.cursor.position.y },
    });
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
